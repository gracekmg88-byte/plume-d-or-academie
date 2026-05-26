
-- Supprimer les anciennes politiques storage trop larges
DROP POLICY IF EXISTS "Fichiers publics accessibles" ON storage.objects;
DROP POLICY IF EXISTS "Mise à jour pour authentifiés" ON storage.objects;
DROP POLICY IF EXISTS "Suppression pour authentifiés" ON storage.objects;
DROP POLICY IF EXISTS "Upload pour authentifiés" ON storage.objects;

-- Resserrer realtime : remplacer la règle "USING (true)"
DROP POLICY IF EXISTS "Authenticated can read realtime" ON realtime.messages;

CREATE POLICY "Users receive own notifications and chat via realtime"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    (realtime.topic() LIKE 'notifications%' AND realtime.topic() = 'notifications:' || auth.uid()::text)
    OR realtime.topic() = 'chat_messages'
    OR realtime.topic() LIKE 'realtime:public:chat_messages%'
    OR (realtime.topic() LIKE 'realtime:public:notifications%')
  );
