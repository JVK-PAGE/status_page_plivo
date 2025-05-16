import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import IncidentForm from "@/components/incidents/incident-form";

export default async function IncidentPage({
  params,
}: {
  params: { incidentId: string };
}) {
  const { userId, orgId } = auth();

  if (!userId || !orgId) {
    redirect("/sign-in");
  }

  const incident = await db.incident.findUnique({
    where: {
      id: params.incidentId,
      organization: {
        clerkOrgId: orgId,
      },
    },
    include: {
      services: {
        select: {
          serviceId: true,
        },
      },
    },
  });

  if (!incident) {
    redirect("/dashboard/incidents");
  }

  const services = await db.service.findMany({
    where: { organization: { clerkOrgId: orgId } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Update Incident</h1>
      <IncidentForm
        organizationId={incident.organizationId}
        services={services}
        incident={{
          ...incident,
          services: incident.services,
        }}
        incidentType={incident.type as "incident" | "maintenance"}
      />
    </div>
  );
}
