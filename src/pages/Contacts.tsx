import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users2, AlertCircle, CheckCircle2, Loader, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ContactEnrichmentTask, Contact, TaskStatus } from "@/types/index";
import { formatDistanceToNow } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Contacts = () => {
  const [tasks, setTasks] = useState<ContactEnrichmentTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: taskData, error: tasksError } = await supabase
      .from('contact_enrichment_tasks')
      .select('*, contacts(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
      toast.error("Failed to load contact enrichment tasks.");
    } else {
      setTasks(taskData as ContactEnrichmentTask[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
    
    const channel = supabase.channel('contact_enrichment_tasks_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_enrichment_tasks' },
        (payload) => {
          console.log('Change received!', payload)
          fetchTasks();
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel);
    }

  }, [fetchTasks]);

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Loader className="mr-1 h-3 w-3 animate-spin" />Processing</Badge>;
      case 'complete':
        return <Badge className="bg-green-600 text-white"><CheckCircle2 className="mr-1 h-3 w-3" />Complete</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="mr-1 h-3 w-3" />Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col">
      <Header title="Contact Enrichment" />
      <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Enrichment Tasks</CardTitle>
            <CardDescription>Monitor the background tasks finding contacts for your opportunities.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : tasks.length > 0 ? (
              <Accordion type="single" collapsible className="w-full">
                {tasks.map((task) => (
                  <AccordionItem value={task.id} key={task.id}>
                    <AccordionTrigger>
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-4">
                          <span className="font-medium">{task.company_name}</span>
                          {getStatusBadge(task.status)}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {task.error_message && <p className="text-sm text-destructive mb-2 px-4">Error: {task.error_message}</p>}
                      {task.contacts && task.contacts.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Job Title</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>LinkedIn</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {task.contacts.map((contact: Contact) => (
                              <TableRow key={contact.id}>
                                <TableCell>{contact.name}</TableCell>
                                <TableCell>{contact.job_title}</TableCell>
                                <TableCell>{contact.email || 'N/A'}</TableCell>
                                <TableCell>
                                  {contact.linkedin_profile_url && (
                                    <Button variant="link" asChild className="p-0 h-auto">
                                      <a href={contact.linkedin_profile_url} target="_blank" rel="noopener noreferrer">
                                        View Profile
                                      </a>
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-sm text-muted-foreground px-4">No contacts found for this task yet.</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm py-24">
                <div className="flex flex-col items-center gap-1 text-center">
                  <Users2 className="h-10 w-10 text-muted-foreground" />
                  <h3 className="text-2xl font-bold tracking-tight">No Contact Searches</h3>
                  <p className="text-sm text-muted-foreground">
                    Go to the <Link to="/opportunities" className="underline">Opportunities</Link> page to start finding contacts.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Contacts;