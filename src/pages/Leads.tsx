import { useState, useEffect, useCallback, useMemo } from "react";
import { Header } from "@/components/Header";
import { Target, MoreHorizontal, Eye, Users, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Opportunity, Contact } from "@/types/index";
import { useNavigate } from "react-router-dom";
import { useExtension } from "@/context/ExtensionContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LeadAnalysisDialog } from "@/components/LeadAnalysisDialog";
import { ViewContactsDialog } from "@/components/ViewContactsDialog";

const Leads = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [contactsByOppId, setContactsByOppId] = useState<Map<string, Contact[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [generatingCampaignForContactId, setGeneratingCampaignForContactId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const navigate = useNavigate();
  const { isExtensionInstalled, extensionId } = useExtension();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [oppsRes, contactsRes] = await Promise.all([
      supabase.from('opportunities').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('contacts').select('*').eq('user_id', user.id)
    ]);

    if (oppsRes.error || contactsRes.error) {
      toast.error("Failed to load data.");
    } else {
      setOpportunities(oppsRes.data as Opportunity[]);
      const groupedContacts = new Map<string, Contact[]>();
      (contactsRes.data as Contact[]).forEach(contact => {
        const oppContacts = groupedContacts.get(contact.opportunity_id) || [];
        oppContacts.push(contact);
        groupedContacts.set(contact.opportunity_id, oppContacts);
      });
      setContactsByOppId(groupedContacts);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerateCampaignForContact = async (opportunity: Opportunity, contact: Contact) => {
    setGeneratingCampaignForContactId(contact.id);
    const toastId = toast.loading(`Drafting email for ${contact.name}...`);
    try {
      const { error } = await supabase.functions.invoke('generate-outreach-for-opportunity', {
        body: { opportunityId: opportunity.id, contact },
      });
      if (error) throw error;
      toast.success("Draft created!", {
        id: toastId,
        description: "You can now view it in the Pipeline.",
        action: { label: "View Pipeline", onClick: () => navigate('/pipeline') },
      });
    } catch (e) {
      toast.error((e as Error).message, { id: toastId });
    } finally {
      setGeneratingCampaignForContactId(null);
    }
  };

  const handleFindContacts = async (opportunity: Opportunity) => {
    if (!isExtensionInstalled) {
      toast.info("Please install the Coogi Chrome Extension to find contacts.");
      return;
    }
    const toastId = toast.loading(`Queuing contact search for ${opportunity.company_name}...`);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in.");
      const { error } = await supabase.from('contact_enrichment_tasks').insert({
        user_id: user.id,
        opportunity_id: opportunity.id,
        company_name: opportunity.company_name,
        status: 'pending'
      });
      if (error) throw error;
      toast.success("Task created! The extension will now search for contacts.", { id: toastId });
    } catch (e) {
      toast.error(`Failed to create task: ${(e as Error).message}`, { id: toastId });
    }
  };

  const filteredOpportunities = useMemo(() => {
    if (!filter) return opportunities;
    return opportunities.filter(opp => 
      opp.company_name.toLowerCase().includes(filter.toLowerCase()) ||
      opp.role.toLowerCase().includes(filter.toLowerCase())
    );
  }, [opportunities, filter]);

  return (
    <div className="flex flex-col">
      <Header title="Leads" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>All Leads</CardTitle>
                <CardDescription>All potential opportunities found by your agents.</CardDescription>
              </div>
              <div className="w-full max-w-sm">
                <Input 
                  placeholder="Filter by company or role..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredOpportunities.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Match Score</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOpportunities.map((opp) => {
                    const contacts = contactsByOppId.get(opp.id) || [];
                    return (
                      <TableRow key={opp.id}>
                        <TableCell className="font-medium">{opp.company_name}</TableCell>
                        <TableCell>{opp.role}</TableCell>
                        <TableCell className="text-muted-foreground">{opp.location}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={opp.match_score * 10} className="h-2 w-24" />
                            <span>{opp.match_score}/10</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <LeadAnalysisDialog opportunity={opp}>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <Eye className="mr-2 h-4 w-4" /> View Analysis
                                </DropdownMenuItem>
                              </LeadAnalysisDialog>
                              <DropdownMenuItem onClick={() => handleFindContacts(opp)}>
                                <Users className="mr-2 h-4 w-4" /> Find Contacts
                              </DropdownMenuItem>
                              {contacts.length > 0 && (
                                <ViewContactsDialog
                                  opportunity={opp}
                                  contacts={contacts}
                                  onGenerateCampaign={contact => handleGenerateCampaignForContact(opp, contact)}
                                  isGenerating={!!generatingCampaignForContactId}
                                  generatingContactId={generatingCampaignForContactId}
                                >
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                    <MessageSquare className="mr-2 h-4 w-4" /> View Contacts ({contacts.length})
                                  </DropdownMenuItem>
                                </ViewContactsDialog>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm py-24">
                <div className="flex flex-col items-center gap-1 text-center">
                  <Target className="h-10 w-10 text-muted-foreground" />
                  <h3 className="text-2xl font-bold tracking-tight">No Leads Found Yet</h3>
                  <p className="text-sm text-muted-foreground">Run an agent from the Agents page to find your first lead.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Leads;