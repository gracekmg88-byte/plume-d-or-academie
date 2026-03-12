import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Feather, LogOut, ArrowLeft, Lock, Eye, EyeOff, Settings, CreditCard, ImageDown, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useBillingConfig } from "@/hooks/useBillingConfig";
import { useDownloadSetting } from "@/hooks/useDownloadSetting";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PaymentSettingsForm } from "@/components/admin/PaymentSettingsForm";
import { compressImage } from "@/lib/compress-image";

export default function AdminSettings() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const { hidePremiumUI } = useBillingConfig();
  const { allowDownloads, toggleDownload } = useDownloadSetting();
  const navigate = useNavigate();
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    if (formData.newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.newPassword,
      });

      if (error) throw error;

      toast.success("Mot de passe mis à jour avec succès");
      setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la mise à jour du mot de passe");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [compressionProgress, setCompressionProgress] = useState("");

  const handleCompressCovers = async () => {
    setIsCompressing(true);
    setCompressionProgress("Récupération de la liste...");
    try {
      // Get list of covers from edge function
      const { data, error } = await supabase.functions.invoke("compress-covers");
      if (error) throw error;
      const covers = (data as { covers: { id: string; url: string }[] }).covers;

      if (!covers.length) {
        toast.info("Aucune couverture à compresser");
        return;
      }

      let compressed = 0;
      let skipped = 0;
      let totalSaved = 0;

      for (let i = 0; i < covers.length; i++) {
        const cover = covers[i];
        setCompressionProgress(`${i + 1}/${covers.length} — ${cover.id.slice(0, 8)}...`);

        try {
          // Download original
          const response = await fetch(cover.url);
          if (!response.ok) { skipped++; continue; }
          const blob = await response.blob();
          const oldSize = blob.size;

          // Skip if already small
          if (oldSize < 150 * 1024) { skipped++; continue; }

          // Compress client-side
          const file = new File([blob], "cover.jpg", { type: blob.type });
          const compressedFile = await compressImage(file, { maxWidth: 800, maxHeight: 1200, quality: 0.75 });
          const newSize = compressedFile.size;

          if (newSize >= oldSize) { skipped++; continue; }

          // Upload compressed version
          const ext = compressedFile.name.split(".").pop() || "webp";
          const fileName = `covers/compressed_${cover.id}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("publications")
            .upload(fileName, compressedFile, { upsert: true, contentType: compressedFile.type });

          if (uploadError) { skipped++; continue; }

          const { data: urlData } = supabase.storage
            .from("publications")
            .getPublicUrl(fileName);

          // Update publication
          await supabase
            .from("publications")
            .update({ cover_image_url: urlData.publicUrl })
            .eq("id", cover.id);

          totalSaved += oldSize - newSize;
          compressed++;
        } catch {
          skipped++;
        }
      }

      if (compressed > 0) {
        toast.success(`${compressed} image(s) compressée(s), ${Math.round(totalSaved / 1024)} KB économisés`);
      } else {
        toast.info("Toutes les images sont déjà optimisées");
      }
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la compression");
    } finally {
      setIsCompressing(false);
      setCompressionProgress("");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <h1 className="font-serif text-2xl font-bold text-foreground mb-4">
            Accès non autorisé
          </h1>
          <p className="text-muted-foreground mb-6">
            Vous devez être administrateur pour accéder à cette page.
          </p>
          <Link to="/admin">
            <Button>Se connecter</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-secondary border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <Feather className="h-5 w-5" />
            </div>
            <div>
              <span className="font-serif font-bold text-secondary-foreground">Administration</span>
              <span className="text-secondary-foreground/60 text-sm ml-2">Paramètres</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/" className="text-secondary-foreground/70 hover:text-secondary-foreground text-sm">
              Voir le site
            </Link>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-secondary-foreground gap-2">
              <LogOut className="h-4 w-4" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-8">
        {/* Back to Dashboard */}
        <Link
          to="/admin/dashboard"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au tableau de bord
        </Link>

        {/* Title */}
        <h1 className="font-serif text-2xl font-bold text-foreground mb-8">
          Paramètres
        </h1>

        {/* Only show payment tab when billing is enabled */}
        {hidePremiumUI ? (
          // Simple account settings only when billing is disabled
          <div className="max-w-2xl space-y-6">
            {/* Account Info */}
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Settings className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Informations du compte</h2>
                  <p className="text-muted-foreground text-sm">{user.email}</p>
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-3 mb-6">
                <Lock className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">Changer le mot de passe</h2>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={formData.newPassword}
                      onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Mise à jour..." : "Mettre à jour le mot de passe"}
                </Button>
              </form>
            </div>

            {/* Download Toggle */}
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Download className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">Autoriser le téléchargement des documents</h2>
                    <p className="text-sm text-muted-foreground">
                      {allowDownloads ? "Les utilisateurs peuvent télécharger les documents" : "Documents en lecture seule uniquement"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={allowDownloads}
                  onCheckedChange={(checked) => {
                    toggleDownload.mutate(checked, {
                      onSuccess: () => toast.success(checked ? "Téléchargement activé" : "Téléchargement désactivé"),
                      onError: () => toast.error("Erreur lors de la mise à jour"),
                    });
                  }}
                  disabled={toggleDownload.isPending}
                />
              </div>
            </div>

            {/* Compress Covers */}
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-3 mb-4">
                <ImageDown className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">Optimisation des images</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Compresse toutes les images de couverture existantes pour réduire leur taille et accélérer le chargement.
              </p>
              <Button
                onClick={handleCompressCovers}
                disabled={isCompressing}
                variant="outline"
                className="w-full gap-2"
              >
                {isCompressing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {compressionProgress || "Compression en cours..."}
                  </>
                ) : (
                  <>
                    <ImageDown className="h-4 w-4" />
                    Compresser les couvertures existantes
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          // Full settings with payment tab when billing is enabled
          <Tabs defaultValue="account" className="max-w-2xl">
            <TabsList className="mb-6">
              <TabsTrigger value="account" className="gap-2">
                <Settings className="h-4 w-4" />
                Compte
              </TabsTrigger>
              <TabsTrigger value="payment" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Paiement
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="space-y-6">
              {/* Account Info */}
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Settings className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">Informations du compte</h2>
                    <p className="text-muted-foreground text-sm">{user.email}</p>
                  </div>
                </div>
              </div>

              {/* Change Password */}
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Lock className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold text-foreground">Changer le mot de passe</h2>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={formData.newPassword}
                        onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Mise à jour..." : "Mettre à jour le mot de passe"}
                  </Button>
                </form>
              </div>

              {/* Compress Covers */}
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-4">
                  <ImageDown className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold text-foreground">Optimisation des images</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Compresse toutes les images de couverture existantes pour réduire leur taille et accélérer le chargement.
                </p>
                <Button
                  onClick={handleCompressCovers}
                  disabled={isCompressing}
                  variant="outline"
                  className="w-full gap-2"
                >
                  {isCompressing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {compressionProgress || "Compression en cours..."}
                    </>
                  ) : (
                    <>
                      <ImageDown className="h-4 w-4" />
                      Compresser les couvertures existantes
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="payment">
              <PaymentSettingsForm />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
