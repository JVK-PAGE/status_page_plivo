import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pusherServer } from "@/lib/pusher";
import { z } from "zod";

const incidentSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(10).max(1000),
  status: z.enum(["investigating", "identified", "monitoring", "resolved"]),
  impact: z.enum(["minor", "major", "critical"]),
  serviceIds: z.array(z.string().cuid()).min(1),
  organizationId: z.string().cuid(),
  type: z.enum(["incident", "maintenance"]).optional().default("incident"),
});

export async function POST(req: Request) {
  try {
    const { userId, orgId } = auth();

    if (!userId || !orgId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const json = await req.json();
    const validation = incidentSchema.safeParse(json);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { title, description, status, impact, serviceIds, organizationId, type } = validation.data;

    // Verify organization belongs to user
    const organization = await db.organization.findFirst({
      where: {
        id: organizationId,
        clerkOrgId: orgId,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Verify all services belong to organization
    const servicesCount = await db.service.count({
      where: {
        id: { in: serviceIds },
        organizationId,
      },
    });

    if (servicesCount !== serviceIds.length) {
      return NextResponse.json(
        { error: "One or more services not found" },
        { status: 400 }
      );
    }

    // Create transaction to ensure data consistency
    const incident = await db.$transaction(async (tx) => {
      const incident = await tx.incident.create({
        data: {
          title,
          description,
          status,
          impact,
          type,
          organizationId,
          startedAt: new Date(),
        },
      });

      await tx.incidentService.createMany({
        data: serviceIds.map(serviceId => ({
          incidentId: incident.id,
          serviceId,
        })),
      });

      return tx.incident.findUnique({
        where: { id: incident.id },
        include: {
          services: {
            include: {
              service: true,
            },
          },
        },
      });
    });

    // Trigger real-time updates
    await pusherServer.trigger(
      `org-${organizationId}`,
      "incident-created",
      incident
    );

    return NextResponse.json(incident);
  } catch (error) {
    console.error("[INCIDENTS_POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
