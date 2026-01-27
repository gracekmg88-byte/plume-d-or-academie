import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import {
  Users,
  Crown,
  Star,
  Search,
  ArrowUpDown,
  Loader2,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useAdminUsers, SubscriptionType } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function AdminUsers() {
  const { user, loading, isAdmin } = useAuth();
  const { users, isLoading, updateSubscription } = useAdminUsers();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "free" | "premium">("all");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/admin");
    }
  }, [user, loading, isAdmin, navigate]);

  const handleSubscriptionChange = async (userId: string, newType: SubscriptionType) => {
    try {
      await updateSubscription.mutateAsync({ userId, subscriptionType: newType });
      toast({
        title: "Abonnement modifié",
        description: `L'utilisateur est maintenant ${newType === "premium" ? "Premium" : "Gratuit"}`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'abonnement",
        variant: "destructive",
      });
    }
  };

  const filteredUsers = users?.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterType === "all" || u.subscription_type === filterType;
    return matchesSearch && matchesFilter;
  });

  if (loading || !isAdmin) {
    return (
      <Layout>
        <div className="container py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const premiumCount = users?.filter((u) => u.subscription_type === "premium").length || 0;
  const freeCount = users?.filter((u) => u.subscription_type === "free").length || 0;

  return (
    <Layout>
      <div className="container py-8 md:py-12">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="font-serif text-3xl font-bold text-foreground">
              Gestion des utilisateurs
            </h1>
          </div>
          <p className="text-muted-foreground">
            Gérez les comptes utilisateurs et leurs abonnements
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="text-2xl font-bold text-foreground">{users?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Total utilisateurs</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold text-foreground">{premiumCount}</span>
            </div>
            <div className="text-sm text-muted-foreground">Premium</div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold text-foreground">{freeCount}</span>
            </div>
            <div className="text-sm text-muted-foreground">Gratuit</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par email ou nom..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrer par type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="free">Gratuit</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Users Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            </div>
          ) : filteredUsers && filteredUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      Type
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                  <TableHead>Inscrit le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((userProfile) => (
                  <TableRow key={userProfile.id}>
                    <TableCell className="font-medium">
                      {userProfile.full_name || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {userProfile.email}
                    </TableCell>
                    <TableCell>
                      {userProfile.subscription_type === "premium" ? (
                        <Badge className="bg-primary text-primary-foreground">
                          <Crown className="h-3 w-3 mr-1" />
                          Premium
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Star className="h-3 w-3 mr-1" />
                          Gratuit
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(userProfile.created_at), "d MMM yyyy", {
                        locale: fr,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {userProfile.subscription_type === "free" ? (
                        <Button
                          size="sm"
                          onClick={() =>
                            handleSubscriptionChange(userProfile.user_id, "premium")
                          }
                          disabled={updateSubscription.isPending}
                        >
                          <Crown className="h-3 w-3 mr-1" />
                          Activer Premium
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleSubscriptionChange(userProfile.user_id, "free")
                          }
                          disabled={updateSubscription.isPending}
                        >
                          Rétrograder
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun utilisateur trouvé</p>
            </div>
          )}
        </div>

        {/* Back to dashboard */}
        <div className="mt-8">
          <Button variant="outline" onClick={() => navigate("/admin/dashboard")}>
            ← Retour au tableau de bord
          </Button>
        </div>
      </div>
    </Layout>
  );
}
