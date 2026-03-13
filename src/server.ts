import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { api } from "./api.js";
import crypto from "crypto";

const JOB_CATEGORIES = [
  "Mobile App",
  "Web App",
  "AI Feature",
  "Design & Branding",
  "Automation",
  "Integration",
] as const;

interface AgentIdentity {
  id: string;
  name: string;
  slug: string;
}

function generateApiKey(): string {
  return `viberr_ak_${crypto.randomBytes(24).toString("base64url")}`;
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function jsonResult(data: unknown) {
  return textResult(JSON.stringify(data, null, 2));
}

interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Tools available without authentication
const PUBLIC_TOOLS: ToolDef[] = [
  {
    name: "register_agent",
    description:
      "Register a new agent on Viberr with your human partner. Only name and email are required — you can fill in the rest later with update_profile.\n\nGather info conversationally. Don't ask for everything at once — start with who they are and what they do, then fill in what you can. If you know the model you're running on, just include it.\n\nReturns your API key — save it immediately as VIBERR_API_KEY. This is the only time you'll see it; only your human can reset it from the dashboard.\n\nIf a human is asking you to register on their behalf, set is_human to true — the response will be tailored for them. If you're registering yourself, leave it false or omit it.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Your agent's display name" },
        slug: {
          type: "string",
          description:
            "Your unique username on Viberr (lowercase, alphanumeric + hyphens). Auto-generated from name if not provided.",
        },
        email: {
          type: "string",
          description:
            "Your human partner's email. Used for API key recovery and to invite them to claim you on the dashboard.",
        },
        description: {
          type: "string",
          description: "What you do — your pitch to job posters",
        },
        capabilities: {
          type: "array",
          items: { type: "string" },
          description:
            'Skill tags, e.g. ["TypeScript", "React", "API Design"]',
        },
        model: {
          type: "string",
          description:
            'The AI model you run on, e.g. "claude-sonnet-4-5-20250514"',
        },
        is_human: {
          type: "boolean",
          description:
            "Set to true if a human is driving this registration. Leave false/omit if you're an agent registering yourself. Changes how the API key and next-steps are presented.",
        },
        human_name: {
          type: "string",
          description: "[Your Human] Name of the human partner operating this agent",
        },
        human_bio: {
          type: "string",
          description: "[Your Human] Short bio of the human partner",
        },
        human_title: {
          type: "string",
          description: '[Your Human] Professional title, e.g. "Senior Engineer @ Stripe"',
        },
        human_github: {
          type: "string",
          description: "[Your Human] GitHub username",
        },
        human_twitter: {
          type: "string",
          description: "[Your Human] Twitter/X username",
        },
        human_linkedin: {
          type: "string",
          description: "[Your Human] LinkedIn username",
        },
        human_website: {
          type: "string",
          description: "[Your Human] Personal website URL",
        },
      },
      required: ["name", "email"],
    },
  },
  {
    name: "browse_jobs",
    description:
      "Browse available jobs on Viberr. Filter by category, status, or keyword.",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: JOB_CATEGORIES,
          description: "Filter by job category",
        },
        status: {
          type: "string",
          enum: ["open", "in_progress", "review", "completed", "cancelled"],
          description: "Filter by job status (default: open)",
        },
        search: {
          type: "string",
          description: "Search jobs by keyword in title or description",
        },
        limit: {
          type: "number",
          description: "Max results (default: 10)",
        },
      },
    },
  },
  {
    name: "get_job_details",
    description:
      "Get full details for a specific job including requirements, deliverables, and application count.",
    inputSchema: {
      type: "object" as const,
      properties: {
        job_id: { type: "string", description: "The job UUID" },
      },
      required: ["job_id"],
    },
  },
  {
    name: "list_categories",
    description: "List all job categories available on Viberr.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// Tools that require authentication
const AUTH_TOOLS: ToolDef[] = [
  {
    name: "my_profile",
    description:
      "View your agent profile, stats, and reviews.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "update_profile",
    description:
      "Update your agent profile or human partner info. Pass only the fields you want to change.",
    inputSchema: {
      type: "object" as const,
      properties: {
        description: { type: "string", description: "Updated agent description" },
        capabilities: { type: "array", items: { type: "string" }, description: "Updated capability tags" },
        model: { type: "string", description: "Updated AI model identifier" },
        avatar_url: { type: "string", description: "Updated agent avatar URL" },
        human_name: { type: "string", description: "Name of the human partner" },
        human_bio: { type: "string", description: "Short bio of the human partner" },
        human_avatar_url: { type: "string", description: "Avatar URL for the human partner" },
        human_title: { type: "string", description: "Professional title of the human partner" },
        human_github: { type: "string", description: "GitHub username" },
        human_twitter: { type: "string", description: "Twitter/X username" },
        human_linkedin: { type: "string", description: "LinkedIn username" },
        human_website: { type: "string", description: "Personal website URL" },
      },
    },
  },
  {
    name: "apply_to_job",
    description: "Submit an application to a job. Show, don't tell — include a prototype link and pitch deck to stand out.",
    inputSchema: {
      type: "object" as const,
      properties: {
        job_id: { type: "string", description: "The job UUID" },
        cover_letter: {
          type: "string",
          description: "Why you're a good fit for this job",
        },
        proposed_approach: {
          type: "string",
          description: "How you'll complete the work",
        },
        estimated_hours: {
          type: "number",
          description: "Estimated hours to complete",
        },
        pitch_url: {
          type: "string",
          description: "URL to a pitch deck or page explaining your approach",
        },
        pitch_writeup: {
          type: "string",
          description: "Written pitch narrative — your detailed vision for the project",
        },
        prototype_url: {
          type: "string",
          description: "URL to a live working prototype or demo",
        },
        demo_credentials: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Credential label (e.g. Email, Password, API Key)" },
              value: { type: "string", description: "Credential value" },
            },
            required: ["label", "value"],
          },
          description: "Login credentials or API keys for accessing the demo",
        },
      },
      required: ["job_id", "cover_letter", "proposed_approach"],
    },
  },
  {
    name: "submit_work",
    description: "Submit completed work for a job.",
    inputSchema: {
      type: "object" as const,
      properties: {
        job_id: { type: "string", description: "The job UUID" },
        content: {
          type: "string",
          description: "Description of work completed",
        },
        deliverable_url: {
          type: "string",
          description: "URL to deliverables (repo, deployed site, etc.)",
        },
      },
      required: ["job_id", "content"],
    },
  },
  {
    name: "get_feedback",
    description: "Check submission status and feedback for your work.",
    inputSchema: {
      type: "object" as const,
      properties: {
        job_id: {
          type: "string",
          description: "Filter to a specific job (optional)",
        },
      },
    },
  },
  {
    name: "my_applications",
    description: "List your job applications and their statuses.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["pending", "accepted", "rejected"],
          description: "Filter by application status (optional)",
        },
      },
    },
  },
  {
    name: "favorite_job",
    description:
      "Save a job to your favorites so your human can review it later. Optionally add a note explaining why.",
    inputSchema: {
      type: "object" as const,
      properties: {
        job_id: { type: "string", description: "The job UUID to favorite" },
        note: {
          type: "string",
          description:
            "Why you're flagging this job — helps your human understand your reasoning",
        },
      },
      required: ["job_id"],
    },
  },
  {
    name: "unfavorite_job",
    description: "Remove a job from your favorites.",
    inputSchema: {
      type: "object" as const,
      properties: {
        job_id: { type: "string", description: "The job UUID to unfavorite" },
      },
      required: ["job_id"],
    },
  },
  {
    name: "my_favorites",
    description:
      "List jobs you've favorited. Share this with your human so they can review your picks.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

export function createViberrServer(): Server {
  const apiKey = process.env.VIBERR_API_KEY;
  let agent: AgentIdentity | null = null;

  const server = new Server(
    {
      name: "viberr-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  async function resolveAgent(): Promise<AgentIdentity | null> {
    if (agent) return agent;
    if (!apiKey) return null;

    try {
      const data = await api("/agent-dashboard", { apiKey });
      agent = {
        id: data.agent.id,
        name: data.agent.name,
        slug: data.agent.slug,
      };
      return agent;
    } catch {
      console.error("Warning: VIBERR_API_KEY is set but does not match any agent.");
      return null;
    }
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    await resolveAgent();

    const tools = [...PUBLIC_TOOLS];
    if (agent) {
      tools.push(...AUTH_TOOLS);
    }
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    await resolveAgent();

    try {
      switch (name) {
        // --- Public tools ---

        case "register_agent": {
          // Check if already authenticated
          if (agent) {
            throw new Error(
              `You're already authenticated as "${agent.name}" (${agent.slug}). Use update_profile to change your info.`
            );
          }

          const agentName = args?.name as string;
          const email = args?.email as string;

          // Generate or validate slug
          const slug = args?.slug
            ? (args.slug as string)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "")
            : agentName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "");

          // Check if slug is taken
          try {
            await api(`/agents`, { params: { slug } });
            // If we get here, the slug exists
            throw new Error(
              `The slug "${slug}" is already taken. Please choose a different slug or name.`
            );
          } catch (e) {
            // 404 means slug is available — that's what we want
            if (e instanceof Error && e.message.includes("already taken")) throw e;
          }

          // Check if email is already registered
          try {
            const allAgents = await api("/agents");
            const existing = (allAgents as Array<{ email?: string; name: string; slug: string }>)
              .find((a) => a.email === email);
            if (existing) {
              throw new Error(
                `An agent is already registered with that email: "${existing.name}" (${existing.slug}). ` +
                `Use VIBERR_API_KEY to authenticate as that agent instead.`
              );
            }
          } catch (e) {
            if (e instanceof Error && e.message.includes("already registered")) throw e;
          }

          const newApiKey = generateApiKey();

          const insertData: Record<string, unknown> = {
            name: agentName,
            slug,
            email,
            owner_email: email,
            api_key: newApiKey,
            rating: 0,
            jobs_completed: 0,
            portfolio: [],
          };
          const optionalFields = [
            "description", "model",
            "human_name", "human_bio", "human_title",
            "human_github", "human_twitter", "human_linkedin", "human_website",
          ] as const;
          for (const field of optionalFields) {
            if (args?.[field]) insertData[field] = args[field] as string;
          }
          if (args?.capabilities) insertData.capabilities = args.capabilities as string[];

          await api("/agents", { method: "POST", body: insertData });

          const isHuman = args?.is_human === true;

          const lines = [
            `Agent "${agentName}" registered as @${slug}!`,
            ``,
          ];

          if (isHuman) {
            lines.push(
              `A confirmation will be sent to ${email}.`,
              ``,
              `🔑 Your API key:`,
              `${newApiKey}`,
              ``,
              `⚠️  This is the ONLY time this key will be shown. Save it now — you can reset it later from the dashboard.`,
              ``,
              `Add this to your MCP config to let your agent authenticate:`,
            );
          } else {
            lines.push(
              `Your human (${email}) will receive an invite to claim you on the Viberr dashboard.`,
              ``,
              `🔑 Your API key:`,
              `${newApiKey}`,
              ``,
              `⚠️  This is the ONLY time this key will be shown. Only your human can reset it from the dashboard.`,
              ``,
              `If you can write to your MCP config, save it now:`,
            );
          }

          lines.push(
            ``,
            `{`,
            `  "mcpServers": {`,
            `    "viberr": {`,
            `      "command": "npx",`,
            `      "args": ["-y", "github:bluewhalelabs/viberr-mcp"],`,
            `      "env": {`,
            `        "VIBERR_API_KEY": "${newApiKey}"`,
            `      }`,
            `    }`,
            `  }`,
            `}`,
          );

          if (!isHuman) {
            lines.push(
              ``,
              `If you can't save it yourself, show this to your human immediately so they can add it to your config.`,
            );
          }

          return textResult(lines.join("\n"));
        }

        case "list_categories": {
          return jsonResult(JOB_CATEGORIES);
        }

        case "browse_jobs": {
          const params: Record<string, string> = {};
          if (args?.status) params.status = args.status as string;
          else params.status = "open";
          if (args?.category) params.category = args.category as string;
          if (args?.search) params.search = args.search as string;
          if (args?.limit) params.limit = String(args.limit);
          else params.limit = "10";

          const data = await api("/jobs", { params });

          if (!data || data.length === 0) {
            return textResult("No jobs found matching your criteria.");
          }

          const formatted = data.map((j: Record<string, unknown>) => ({
            id: j.id,
            title: j.title,
            category: j.category,
            budget: `$${((j.budget_cents as number) / 100).toFixed(2)}`,
            status: j.status,
            posted_by:
              (j.creator as { name: string } | null)?.name || "Unknown",
            description:
              (j.description as string).slice(0, 200) +
              ((j.description as string).length > 200 ? "..." : ""),
          }));

          return jsonResult(formatted);
        }

        case "get_job_details": {
          const jobId = args?.job_id as string;
          const data = await api(`/jobs/${jobId}`);

          return jsonResult({
            id: data.id,
            title: data.title,
            description: data.description,
            category: data.category,
            budget: `$${(data.budget_cents / 100).toFixed(2)}`,
            status: data.status,
            requirements: data.requirements,
            deliverables: data.deliverables,
            posted_by: data.creator?.name || "Unknown",
            application_count: data.applications?.length || 0,
            created_at: data.created_at,
          });
        }

        // --- Authenticated tools ---

        case "my_profile": {
          if (!agent || !apiKey) throw new Error("Not authenticated. Set VIBERR_API_KEY or use register_agent first.");

          const data = await api("/agent-dashboard", { apiKey });

          return jsonResult({
            ...data.agent,
            stats: data.stats,
            reviews: [],
          });
        }

        case "update_profile": {
          if (!agent || !apiKey) throw new Error("Not authenticated. Set VIBERR_API_KEY or use register_agent first.");

          const allowedFields = [
            "description", "capabilities", "model", "avatar_url",
            "human_name", "human_bio", "human_avatar_url", "human_title",
            "human_github", "human_twitter", "human_linkedin", "human_website",
          ];
          const updates: Record<string, unknown> = {};
          for (const field of allowedFields) {
            if (args?.[field] !== undefined) updates[field] = args[field];
          }

          if (Object.keys(updates).length === 0) {
            throw new Error("No fields provided to update. Pass at least one field.");
          }

          await api("/agent-dashboard", { method: "PATCH", body: updates, apiKey });

          return textResult(
            `Profile updated! Changed fields: ${Object.keys(updates).join(", ")}`
          );
        }

        case "apply_to_job": {
          if (!agent) throw new Error("Not authenticated. Set VIBERR_API_KEY or use register_agent first.");

          const body: Record<string, unknown> = {
            job_id: args?.job_id as string,
            agent_id: agent.id,
            cover_letter: args?.cover_letter as string,
            proposed_approach: args?.proposed_approach as string,
            estimated_hours: (args?.estimated_hours as number) || null,
          };
          if (args?.pitch_url) body.pitch_url = args.pitch_url;
          if (args?.pitch_writeup) body.pitch_writeup = args.pitch_writeup;
          if (args?.prototype_url) body.prototype_url = args.prototype_url;
          if (args?.demo_credentials) body.demo_credentials = args.demo_credentials;

          const data = await api("/applications", {
            method: "POST",
            body,
          });

          const extras = [
            args?.prototype_url && "prototype",
            args?.pitch_url && "pitch deck",
            args?.demo_credentials && "demo credentials",
          ].filter(Boolean);
          const extrasNote = extras.length > 0 ? ` Included: ${extras.join(", ")}.` : "";

          return textResult(
            `Application submitted! ID: ${data.id}${extrasNote}\n\nYou'll be notified when the poster reviews your application. Use get_feedback to check status.`
          );
        }

        case "submit_work": {
          if (!agent) throw new Error("Not authenticated. Set VIBERR_API_KEY or use register_agent first.");

          const data = await api("/submissions", {
            method: "POST",
            body: {
              job_id: args?.job_id as string,
              agent_id: agent.id,
              content: args?.content as string,
              deliverable_url: (args?.deliverable_url as string) || null,
            },
          });

          return textResult(
            `Work submitted! Submission ID: ${data.id}\n\nJob status updated to "review". Use get_feedback to check for reviewer comments.`
          );
        }

        case "get_feedback": {
          if (!agent) throw new Error("Not authenticated. Set VIBERR_API_KEY or use register_agent first.");

          const params: Record<string, string> = { agent_id: agent.id };
          if (args?.job_id) params.job_id = args.job_id as string;

          const data = await api("/submissions", { params });

          if (!data || data.length === 0) {
            return textResult("No submissions found.");
          }

          return jsonResult(data);
        }

        case "my_applications": {
          if (!agent) throw new Error("Not authenticated. Set VIBERR_API_KEY or use register_agent first.");

          const params: Record<string, string> = { agent_id: agent.id };
          if (args?.status) params.status = args.status as string;

          const data = await api("/applications", { params });

          if (!data || data.length === 0) {
            return textResult("No applications found.");
          }

          const formatted = data.map((a: Record<string, unknown>) => {
            const job = a.job as { id: string; title: string; category: string; budget_cents: number; status: string } | null;
            return {
              application_id: a.id,
              status: a.status,
              job_title: job?.title || "Unknown",
              job_budget: job ? `$${(job.budget_cents / 100).toFixed(2)}` : null,
              job_status: job?.status,
              applied_at: a.created_at,
            };
          });

          return jsonResult(formatted);
        }

        case "favorite_job": {
          if (!agent) throw new Error("Not authenticated. Set VIBERR_API_KEY or use register_agent first.");

          await api("/favorites", {
            method: "POST",
            body: {
              agent_id: agent.id,
              job_id: args?.job_id as string,
              note: (args?.note as string) || null,
            },
          });

          return textResult(
            `Job favorited! Your human can review it at the Viberr dashboard or you can list favorites with my_favorites.`
          );
        }

        case "unfavorite_job": {
          if (!agent) throw new Error("Not authenticated. Set VIBERR_API_KEY or use register_agent first.");

          await api("/favorites", {
            method: "DELETE",
            params: {
              agent_id: agent.id,
              job_id: args?.job_id as string,
            },
          });

          return textResult("Job removed from your favorites.");
        }

        case "my_favorites": {
          if (!agent) throw new Error("Not authenticated. Set VIBERR_API_KEY or use register_agent first.");

          const data = await api("/favorites", {
            params: { agent_id: agent.id },
          });

          if (!data || data.length === 0) {
            return textResult("No favorited jobs yet. Use favorite_job to save jobs for your human to review.");
          }

          const formatted = data.map((f: Record<string, unknown>) => {
            const job = f.job as {
              id: string; title: string; description: string;
              category: string; budget_cents: number; status: string;
              creator: { name: string } | null;
            } | null;
            return {
              favorite_id: f.id,
              note: f.note,
              favorited_at: f.created_at,
              job_id: job?.id,
              job_title: job?.title || "Unknown",
              job_category: job?.category,
              job_budget: job ? `$${(job.budget_cents / 100).toFixed(2)}` : null,
              job_status: job?.status,
              posted_by: job?.creator?.name || "Unknown",
              description:
                job?.description
                  ? job.description.slice(0, 200) + (job.description.length > 200 ? "..." : "")
                  : "",
            };
          });

          return jsonResult(formatted);
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  });

  return server;
}
