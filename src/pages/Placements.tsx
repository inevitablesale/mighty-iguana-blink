import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, DollarSign, MoreHorizontal, Edit, Trash2, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Placement, PlacementStatus } from "@/types/index";
import { format } from 'date-fns';
import { EditPlacementDialog } from "@/components/EditPlacementDialog";

const Placements = () => {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchPlacements = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('placements')
      .select(`*, campaigns (company_name, role)`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching placements:", error);
      toast.error("Failed to load placements.");
    } else {
      const fetchedPlacements = data as Placement[];
      setPlacements(fetchedPlacements);
      const revenue = fetchedPlacements.reduce((sum, p) => sum + (p.fee_amount || 0), 0);
      setTotalRevenue(revenue);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPlacements();
  }, [fetchPlacements]);

  const handleDelete = async (placementId: string) => {
    const { error } = await supabase.from('placements').delete().eq('id', placementId);
    if (error) {
      toast.error('Failed to delete placement.');
      console.error('Error deleting placement:', error);
    } else {
      toast.success('Placement deleted.');
      fetchPlacements();
    }
  };

  const handleUpdateStatus = async (placementId: string, status: PlacementStatus) => {
    const { error } = await supabase
      .from('placements')
      .update({ status })
      .eq('id', placementId);

    if (error) {
      toast.error('Failed to update status.');
    } else {
      toast.success('Placement status updated.');
      fetchPlacements();
    }
  };

  const getStatusBadgeVariant = (status: PlacementStatus) => {
    switch (status) {
      case 'completed': return 'default';
      case 'active': return 'secondary';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6 pt-24">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">From all successful placements</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Placements</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{placements.length}</div>
              <p className="text-xs text-muted-foreground">Candidates successfully placed</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Placements</CardTitle>
            <CardDescription>Manage your successful placements and contracts.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : placements.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {placements.map((placement) => (
                    <TableRow key={placement.id}>
                      <TableCell className="font-medium">{placement.candidate_name}</TableCell>
                      <TableCell>{placement.campaigns?.company_name || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(placement.status)} className={placement.status === 'completed' ? 'bg-green-600 text-white' : ''}>
                          {placement.status.charAt(0).toUpperCase() + placement.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{placement.start_date ? format(new Date(placement.start_date), 'PPP') : 'N/A'}</TableCell>
                      <TableCell className="text-right">${placement.fee_amount?.toLocaleString() || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <EditPlacementDialog placement={placement} onPlacementUpdated={fetchPlacements}>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            </EditPlacementDialog>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <CheckSquare className="mr-2 h-4 w-4" />
                                <span>Update Status</span>
                              </DropdownMenuSubTrigger>
                              <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(placement.id, 'active')}>Active</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(placement.id, 'completed')}>Completed</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleUpdateStatus(placement.id, 'cancelled')}>Cancelled</DropdownMenuItem>
                                </DropdownMenuSubContent>
                              </DropdownMenuPortal>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the placement for {placement.candidate_name}. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(placement.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Award className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-gray-900">No placements yet</h3>
                <p className="mt-1 text-sm text-gray-500">Mark a campaign as "Placed" to get started.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Placements;