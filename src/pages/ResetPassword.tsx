import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Feather, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => navigate("/auth"), 3000);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la réinitialisation");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-parchment p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary text-primary-foreground mb-4">
            <Feather className="h-8 w-8" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-foreground mb-2">Lien invalide</h1>
          <p className="text-muted-foreground mb-6">
            Ce lien de réinitialisation est invalide ou a expiré.
          </p>
          <Link to="/auth">
            <Button>Retour à la connexion</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-parchment p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary text-primary-foreground mb-4">
              <Feather className="h-8 w-8" />
            </div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Nouveau mot de passe
            </h1>
          </Link>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 md:p-8 shadow-elegant">
          {success ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <h2 className="font-serif text-lg font-semibold">Mot de passe mis à jour !</h2>
              <p className="text-muted-foreground text-sm">
                Vous allez être redirigé vers la page de connexion...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="new-password">Nouveau mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirmer le mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-new-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
              </Button>
            </form>
          )}
        </div>

        <div className="text-center mt-6">
          <Link to="/auth" className="text-muted-foreground hover:text-primary text-sm transition-colors">
            ← Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
