-- ============================================================================
-- KMG Bibliothèque — Migration hors Lovable
-- 01 : triggers pg_net et tâche cron sans URL ni clé écrites en dur.
--
-- À APPLIQUER UNIQUEMENT AU NOUVEAU PROJET SUPABASE, après le schéma de base.
-- Ce fichier est volontairement hors de supabase/migrations/ pour ne jamais
-- être appliqué par erreur à l'ancien projet Lovable Cloud.
--
-- Prérequis (une seule fois, dans l'éditeur SQL du nouveau projet ; ne jamais versionner les valeurs) :
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<clé service_role>',        'service_role_key');
--
-- Effet : les 4 triggers et la newsletter hebdomadaire s'authentifient avec la
-- clé service_role, attendue par les fonctions (isServiceRoleRequest). Dans
-- l'ancien projet, cette clé n'était pas définie : les appels étaient rejetés.
-- ============================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Lecture d'un secret du coffre Vault (réservée aux fonctions SECURITY DEFINER).
create or replace function private.vault_secret(_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = _name limit 1
$$;
revoke all on function private.vault_secret(text) from public, anon, authenticated;

-- Appel HTTP d'une fonction Edge du projet, authentifié par la clé service_role.
create or replace function private.call_edge_function(_function text, _body jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  _url text := private.vault_secret('project_url');
  _key text := private.vault_secret('service_role_key');
begin
  if _url is null or _key is null then
    raise warning 'call_edge_function(%): secrets Vault project_url / service_role_key manquants', _function;
    return null;
  end if;
  return net.http_post(
    url := rtrim(_url, '/') || '/functions/v1/' || _function,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || _key),
    body := _body
  );
end;
$$;
revoke all on function private.call_edge_function(text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggers : corps identiques à la production (export du 08/11/2026),
-- seule la construction de l'URL et de l'en-tête Authorization change.
-- ---------------------------------------------------------------------------

create or replace function public.notify_admin_on_contact()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform private.call_edge_function('notify-admin-contact', jsonb_build_object(
    'type', 'INSERT',
    'table', 'contact_messages',
    'record', jsonb_build_object(
      'id', NEW.id,
      'name', NEW.name,
      'email', NEW.email,
      'subject', NEW.subject,
      'message', NEW.message,
      'created_at', NEW.created_at
    )
  ));
  return NEW;
end;
$$;

create or replace function public.notify_admin_on_signup()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform private.call_edge_function('notify-admin-signup', jsonb_build_object(
    'type', 'INSERT',
    'table', 'user_profiles',
    'record', jsonb_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'email', NEW.email,
      'full_name', NEW.full_name,
      'subscription_type', NEW.subscription_type,
      'created_at', NEW.created_at
    )
  ));
  return NEW;
end;
$$;

create or replace function public.notify_chat_push()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform private.call_edge_function('send-chat-push', jsonb_build_object(
    'user_id', NEW.user_id,
    'user_name', NEW.user_name,
    'content', left(NEW.content, 100)
  ));
  return NEW;
end;
$$;

create or replace function public.notify_new_publication()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- Only trigger when publication is published
  if NEW.is_published = true and (OLD is null or OLD.is_published = false) then
    perform private.call_edge_function('send-push-notification', jsonb_build_object(
      'publication_id', NEW.id,
      'title', NEW.title,
      'author', NEW.author,
      'category', NEW.category
    ));
  end if;
  return NEW;
end;
$$;

-- ---------------------------------------------------------------------------
-- Newsletter hebdomadaire (lundi 08:00 UTC, comme en production)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'weekly-newsletter') then
    perform cron.unschedule('weekly-newsletter');
  end if;
end $$;

select cron.schedule(
  'weekly-newsletter',
  '0 8 * * 1',
  $cron$ select private.call_edge_function('send-newsletter', '{}'::jsonb) $cron$
);
