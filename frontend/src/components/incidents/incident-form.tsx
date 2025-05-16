"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

const incidentFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().min(10, "Description must be at least 10 characters").max(1000),
  status: z.enum(["investigating", "identified", "monitoring", "resolved"]),
  impact: z.enum(["minor", "major", "critical"]),
  serviceIds: z.array(z.string()).min(1, "At least one service must be selected"),
});

type IncidentFormValues = z.infer<typeof incidentFormSchema>;

interface IncidentFormProps {
  organizationId: string;
  services: {
    id: string;
    name: string;
    description?: string | null;
  }[];
  incident?: {
    id: string;
    title: string;
    description: string;
    status: string;
    impact: string;
    services: { serviceId: string }[];
  };
  incidentType?: "incident" | "maintenance";
}

export default function IncidentForm({
  organizationId,
  services,
  incident,
  incidentType = "incident",
}: IncidentFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<IncidentFormValues>({
    resolver: zodResolver(incidentFormSchema),
    defaultValues: {
      title: incident?.title || "",
      description: incident?.description || "",
      status: (incident?.status as any) || "investigating",
      impact: (incident?.impact as any) || "minor",
      serviceIds: incident?.services.map(s => s.serviceId) || [],
    }
  });

  const onSubmit = async (data: IncidentFormValues) => {
    try {
      setIsLoading(true);
      
      const endpoint = incident 
        ? `/api/incidents/${incident.id}`
        : "/api/incidents";
      
      const method = incident ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          organizationId,
          type: incidentType,
        }),
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const result = await response.json();

      toast({
        title: incident ? "Incident updated" : "Incident created",
        description: incident
          ? "Your incident has been updated successfully."
          : "Your new incident has been created successfully.",
      });

      router.push("/dashboard/incidents");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error instanceof Error 
          ? error.message 
          : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {incidentType === "maintenance" 
            ? "Schedule Maintenance" 
            : incident ? "Update Incident" : "Report Incident"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={
                        incidentType === "maintenance"
                          ? "Scheduled database maintenance"
                          : "API latency issues"
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide detailed information about the incident"
                      rows={5}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Include relevant details, error messages, and impact.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="investigating">Investigating</SelectItem>
                        <SelectItem value="identified">Identified</SelectItem>
                        <SelectItem value="monitoring">Monitoring</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="impact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Impact</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select impact" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="minor">Minor</SelectItem>
                        <SelectItem value="major">Major</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="serviceIds"
              render={() => (
                <FormItem>
                  <FormLabel>Affected Services</FormLabel>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {services.map((service) => (
                      <FormField
                        key={service.id}
                        control={form.control}
                        name="serviceIds"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(service.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...field.value, service.id])
                                    : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== service.id
                                        )
                                      );
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {service.name}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/incidents")}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : incident ? (
                  "Update Incident"
                ) : (
                  "Create Incident"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
