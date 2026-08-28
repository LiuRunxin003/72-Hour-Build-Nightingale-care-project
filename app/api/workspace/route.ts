import { buildWorkspace, type Role } from "@/lib/workspace-data";

function isRole(value: string | null): value is Role {
  return value === "patient" || value === "staff" || value === "clinician" || value === "admin";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedRole = url.searchParams.get("role");
  const role: Role = isRole(requestedRole) ? requestedRole : "clinician";

  return Response.json(buildWorkspace(role));
}
