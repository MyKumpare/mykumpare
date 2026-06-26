/**
 * MyKumpare MCP Server
 * 
 * Provides AI assistants with tools to interact with the MyKumpare Base44 application.
 * 
 * Setup:
 * 1. Install dependencies: npm install @base44/sdk @modelcontextprotocol/sdk
 * 2. Set environment variables: BASE44_APP_ID, BASE44_SERVICE_TOKEN
 * 3. Configure in your MCP client using mcp-config.json
 */

/* eslint-env node */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@base44/sdk';

// Initialize Base44 client
const base44 = createClient({
  appId: process.env.BASE44_APP_ID,
  serviceToken: process.env.BASE44_SERVICE_TOKEN,
});

// MCP Server instance
const server = new Server(
  {
    name: 'mykumpare-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ─── Tool Definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  // Firms
  {
    name: 'list_firms',
    description: 'List all firms in the system, optionally filtered by type or search term',
    inputSchema: {
      type: 'object',
      properties: {
        firmType: { type: 'string', description: 'Filter by firm type (e.g., "Investment Manager", "Allocator")' },
        search: { type: 'string', description: 'Search term to filter firms by name' },
        includeDeleted: { type: 'boolean', default: false, description: 'Include deleted firms' }
      }
    }
  },
  {
    name: 'get_firm',
    description: 'Get detailed information about a specific firm by ID',
    inputSchema: {
      type: 'object',
      properties: {
        firmId: { type: 'string', description: 'The firm ID' }
      },
      required: ['firmId']
    }
  },
  {
    name: 'create_firm',
    description: 'Create a new firm record',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Firm name' },
        firmTypes: { type: 'array', items: { type: 'string' }, description: 'Array of firm types' },
        website: { type: 'string', description: 'Website URL' },
        linkedinUrl: { type: 'string', description: 'LinkedIn URL' },
        yearFounded: { type: 'integer', description: 'Year founded' },
        description: { type: 'string', description: 'Firm description' }
      },
      required: ['name']
    }
  },

  // Contacts
  {
    name: 'list_contacts',
    description: 'List all contacts, optionally filtered by firm or search term',
    inputSchema: {
      type: 'object',
      properties: {
        firmId: { type: 'string', description: 'Filter by firm ID' },
        search: { type: 'string', description: 'Search term (name, email, title)' },
        includeDeleted: { type: 'boolean', default: false }
      }
    }
  },
  {
    name: 'get_contact',
    description: 'Get detailed information about a specific contact',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'The contact ID' }
      },
      required: ['contactId']
    }
  },
  {
    name: 'create_contact',
    description: 'Create a new contact record',
    inputSchema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', description: 'First name' },
        lastName: { type: 'string', description: 'Last name' },
        email: { type: 'string', description: 'Email address' },
        title: { type: 'string', description: 'Job title' },
        firmIds: { type: 'array', items: { type: 'string' }, description: 'Associated firm IDs' }
      },
      required: ['firstName', 'lastName']
    }
  },

  // Products
  {
    name: 'list_products',
    description: 'List all products, optionally filtered by firm',
    inputSchema: {
      type: 'object',
      properties: {
        firmId: { type: 'string', description: 'Filter by firm ID' },
        includeDeleted: { type: 'boolean', default: false }
      }
    }
  },
  {
    name: 'get_product',
    description: 'Get detailed information about a specific product',
    inputSchema: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'The product ID' }
      },
      required: ['productId']
    }
  },

  // Portfolios
  {
    name: 'list_portfolios',
    description: 'List all portfolios, optionally filtered by allocator firm',
    inputSchema: {
      type: 'object',
      properties: {
        firmId: { type: 'string', description: 'Filter by allocator firm ID' },
        includeDeleted: { type: 'boolean', default: false }
      }
    }
  },

  // Benchmarks
  {
    name: 'list_benchmarks',
    description: 'List all benchmarks, optionally filtered by asset class',
    inputSchema: {
      type: 'object',
      properties: {
        assetClass: { type: 'string', description: 'Filter by asset class (Equity, Fixed Income, etc.)' }
      }
    }
  },

  // Activities
  {
    name: 'list_activities',
    description: 'List activity logs, optionally filtered by contact or firm',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Filter by contact ID' },
        firmId: { type: 'string', description: 'Filter by firm ID' },
        activityType: { type: 'string', description: 'Filter by activity type (Call, Email, Meeting, Note, Other)' },
        startDate: { type: 'string', format: 'date', description: 'Filter activities from this date' },
        endDate: { type: 'string', format: 'date', description: 'Filter activities until this date' }
      }
    }
  },
  {
    name: 'create_activity',
    description: 'Create a new activity log',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Primary contact ID' },
        activityType: { type: 'string', enum: ['Call', 'Email', 'Meeting', 'Note', 'Other'], description: 'Type of activity' },
        activityDate: { type: 'string', format: 'date', description: 'Date of activity' },
        subjects: { type: 'array', items: { type: 'string' }, description: 'Activity subjects' },
        notes: { type: 'string', description: 'Activity notes' },
        associatedFirmsContacts: { 
          type: 'array', 
          items: {
            type: 'object',
            properties: {
              firm_id: { type: 'string' },
              firm_name: { type: 'string' },
              contacts: { 
                type: 'array', 
                items: {
                  type: 'object',
                  properties: {
                    contact_id: { type: 'string' },
                    contact_name: { type: 'string' }
                  }
                }
              }
            }
          },
          description: 'Associated firms and contacts'
        }
      },
      required: ['contactId', 'activityType', 'activityDate']
    }
  },

  // Follow-up Tasks
  {
    name: 'list_tasks',
    description: 'List follow-up tasks, optionally filtered by assignee or status',
    inputSchema: {
      type: 'object',
      properties: {
        assignedToContactId: { type: 'string', description: 'Filter by assignee contact ID' },
        originatorContactId: { type: 'string', description: 'Filter by originator contact ID' },
        firmId: { type: 'string', description: 'Filter by firm ID' },
        status: { type: 'string', enum: ['Not Started', 'In-process', 'Completed', 'Cancelled'], description: 'Filter by status' },
        dueDateStart: { type: 'string', format: 'date', description: 'Filter tasks due from this date' },
        dueDateEnd: { type: 'string', format: 'date', description: 'Filter tasks due until this date' }
      }
    }
  },
  {
    name: 'get_task',
    description: 'Get detailed information about a specific task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID' }
      },
      required: ['taskId']
    }
  },
  {
    name: 'create_task',
    description: 'Create a new follow-up task',
    inputSchema: {
      type: 'object',
      properties: {
        originatorContactId: { type: 'string', description: 'Contact who created the task' },
        originatorContactName: { type: 'string', description: 'Name of originator' },
        dueDate: { type: 'string', format: 'date', description: 'Due date' },
        taskDescription: { type: 'string', description: 'Task description (HTML supported)' },
        assignments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              contact_id: { type: 'string' },
              contact_name: { type: 'string' },
              firm_id: { type: 'string' },
              firm_name: { type: 'string' },
              status: { type: 'string', enum: ['Not Started', 'In-process', 'Completed', 'Cancelled'], default: 'Not Started' },
              notes: { type: 'string' }
            },
            required: ['contact_id', 'contact_name']
          },
          description: 'Task assignments with individual statuses'
        },
        notes: { type: 'string', description: 'Overall task notes' },
        activityId: { type: 'string', description: 'Associated activity ID' }
      },
      required: ['originatorContactId', 'dueDate', 'taskDescription']
    }
  },
  {
    name: 'update_task_status',
    description: 'Update a task assignment status (automatically aggregates to task level)',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task ID' },
        assignmentId: { type: 'string', description: 'The assignment ID to update' },
        status: { type: 'string', enum: ['Not Started', 'In-process', 'Completed', 'Cancelled'], description: 'New status' },
        notes: { type: 'string', description: 'Assignment notes' }
      },
      required: ['taskId', 'assignmentId', 'status']
    }
  },

  // Activity Types & Subjects
  {
    name: 'list_activity_types',
    description: 'List all activity types (Log Types)',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'list_activity_subjects',
    description: 'List all activity subjects',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  // Analytics
  {
    name: 'list_analyses',
    description: 'List all analytics analyses',
    inputSchema: {
      type: 'object',
      properties: {
        visibility: { type: 'string', enum: ['personal', 'firm'], description: 'Filter by visibility' },
        isTemplate: { type: 'boolean', description: 'Filter templates only' }
      }
    }
  },
  {
    name: 'get_analysis',
    description: 'Get detailed information about a specific analysis',
    inputSchema: {
      type: 'object',
      properties: {
        analysisId: { type: 'string', description: 'The analysis ID' }
      },
      required: ['analysisId']
    }
  }
];

// ─── Tool Handlers ─────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Firms
      case 'list_firms': {
        const firms = await base44.entities.Firm.list();
        let filtered = firms;
        if (args.firmType) {
          filtered = filtered.filter(f => 
            (f.firm_types || []).includes(args.firmType) || f.firm_type === args.firmType
          );
        }
        if (args.search) {
          const searchLower = args.search.toLowerCase();
          filtered = filtered.filter(f => f.name.toLowerCase().includes(searchLower));
        }
        if (!args.includeDeleted) {
          filtered = filtered.filter(f => !f.deleted_at);
        }
        return { content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }] };
      }

      case 'get_firm': {
        const firm = await base44.entities.Firm.get(args.firmId);
        return { content: [{ type: 'text', text: JSON.stringify(firm, null, 2) }] };
      }

      case 'create_firm': {
        const firm = await base44.entities.Firm.create({
          name: args.name,
          firm_types: args.firmTypes,
          website: args.website,
          linkedin_url: args.linkedinUrl,
          year_founded: args.yearFounded,
          description: args.description
        });
        return { content: [{ type: 'text', text: JSON.stringify(firm, null, 2) }] };
      }

      // Contacts
      case 'list_contacts': {
        const contacts = await base44.entities.Contact.list();
        let filtered = contacts;
        if (args.firmId) {
          filtered = filtered.filter(c => (c.firm_ids || []).includes(args.firmId));
        }
        if (args.search) {
          const searchLower = args.search.toLowerCase();
          filtered = filtered.filter(c => 
            c.first_name.toLowerCase().includes(searchLower) ||
            c.last_name.toLowerCase().includes(searchLower) ||
            c.email?.toLowerCase().includes(searchLower) ||
            c.title?.toLowerCase().includes(searchLower)
          );
        }
        if (!args.includeDeleted) {
          filtered = filtered.filter(c => !c.deleted_at);
        }
        return { content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }] };
      }

      case 'get_contact': {
        const contact = await base44.entities.Contact.get(args.contactId);
        return { content: [{ type: 'text', text: JSON.stringify(contact, null, 2) }] };
      }

      case 'create_contact': {
        const contact = await base44.entities.Contact.create({
          first_name: args.firstName,
          last_name: args.lastName,
          email: args.email,
          title: args.title,
          firm_ids: args.firmIds
        });
        return { content: [{ type: 'text', text: JSON.stringify(contact, null, 2) }] };
      }

      // Products
      case 'list_products': {
        const products = await base44.entities.Product.list();
        let filtered = products;
        if (args.firmId) {
          filtered = filtered.filter(p => p.firm_id === args.firmId);
        }
        if (!args.includeDeleted) {
          filtered = filtered.filter(p => !p.deleted_at);
        }
        return { content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }] };
      }

      case 'get_product': {
        const product = await base44.entities.Product.get(args.productId);
        return { content: [{ type: 'text', text: JSON.stringify(product, null, 2) }] };
      }

      // Portfolios
      case 'list_portfolios': {
        const portfolios = await base44.entities.Portfolio.list();
        let filtered = portfolios;
        if (args.firmId) {
          filtered = filtered.filter(p => p.firm_id === args.firmId);
        }
        if (!args.includeDeleted) {
          filtered = filtered.filter(p => !p.deleted_at);
        }
        return { content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }] };
      }

      // Benchmarks
      case 'list_benchmarks': {
        const benchmarks = await base44.entities.Benchmark.list();
        let filtered = benchmarks;
        if (args.assetClass) {
          filtered = filtered.filter(b => b.asset_class === args.assetClass);
        }
        return { content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }] };
      }

      // Activities
      case 'list_activities': {
        const activities = await base44.entities.ContactActivity.list();
        let filtered = activities;
        if (args.contactId) {
          filtered = filtered.filter(a => a.contact_id === args.contactId);
        }
        if (args.firmId) {
          filtered = filtered.filter(a => 
            (a.associated_firms_contacts || []).some(fc => fc.firm_id === args.firmId)
          );
        }
        if (args.activityType) {
          filtered = filtered.filter(a => a.activity_type === args.activityType);
        }
        if (args.startDate) {
          filtered = filtered.filter(a => a.activity_date >= args.startDate);
        }
        if (args.endDate) {
          filtered = filtered.filter(a => a.activity_date <= args.endDate);
        }
        return { content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }] };
      }

      case 'create_activity': {
        const activity = await base44.entities.ContactActivity.create({
          contact_id: args.contactId,
          activity_type: args.activityType,
          activity_date: args.activityDate,
          subjects: args.subjects,
          notes: args.notes,
          associated_firms_contacts: args.associatedFirmsContacts
        });
        return { content: [{ type: 'text', text: JSON.stringify(activity, null, 2) }] };
      }

      // Tasks
      case 'list_tasks': {
        const tasks = await base44.entities.FollowUpTask.list();
        let filtered = tasks;
        if (args.assignedToContactId) {
          filtered = filtered.filter(t => 
            t.assigned_to_contact_id === args.assignedToContactId ||
            (t.assignments || []).some(a => a.contact_id === args.assignedToContactId)
          );
        }
        if (args.originatorContactId) {
          filtered = filtered.filter(t => t.originator_contact_id === args.originatorContactId);
        }
        if (args.firmId) {
          filtered = filtered.filter(t => 
            t.originator_firm_id === args.firmId ||
            t.assigned_to_firm_id === args.firmId ||
            (t.assignments || []).some(a => a.firm_id === args.firmId)
          );
        }
        if (args.status) {
          filtered = filtered.filter(t => t.status === args.status);
        }
        if (args.dueDateStart) {
          filtered = filtered.filter(t => t.due_date >= args.dueDateStart);
        }
        if (args.dueDateEnd) {
          filtered = filtered.filter(t => t.due_date <= args.dueDateEnd);
        }
        return { content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }] };
      }

      case 'get_task': {
        const task = await base44.entities.FollowUpTask.get(args.taskId);
        return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
      }

      case 'create_task': {
        const task = await base44.entities.FollowUpTask.create({
          originator_contact_id: args.originatorContactId,
          originator_contact_name: args.originatorContactName,
          due_date: args.dueDate,
          task_description: args.taskDescription,
          assignments: args.assignments,
          notes: args.notes,
          activity_id: args.activityId
        });
        return { content: [{ type: 'text', text: JSON.stringify(task, null, 2) }] };
      }

      case 'update_task_status': {
        const task = await base44.entities.FollowUpTask.get(args.taskId);
        if (!task) {
          throw new Error(`Task ${args.taskId} not found`);
        }
        
        const assignments = task.assignments || [];
        const assignmentIndex = assignments.findIndex(a => a.id === args.assignmentId);
        
        if (assignmentIndex === -1) {
          throw new Error(`Assignment ${args.assignmentId} not found`);
        }

        assignments[assignmentIndex] = {
          ...assignments[assignmentIndex],
          status: args.status,
          notes: args.notes !== undefined ? args.notes : assignments[assignmentIndex].notes,
          status_date: new Date().toISOString().split('T')[0]
        };

        // Compute aggregate status
        const allStatuses = assignments.map(a => a.status || 'Not Started');
        let aggregateStatus = 'Not Started';
        
        if (allStatuses.every(s => s === 'Completed')) aggregateStatus = 'Completed';
        else if (allStatuses.every(s => s === 'Cancelled')) aggregateStatus = 'Cancelled';
        else if (allStatuses.every(s => s === 'Not Started')) aggregateStatus = 'Not Started';
        else aggregateStatus = 'In-process';

        const updated = await base44.entities.FollowUpTask.update(args.taskId, {
          assignments,
          status: aggregateStatus,
          status_date: aggregateStatus !== task.status ? new Date().toISOString().split('T')[0] : undefined
        });

        return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
      }

      // Activity Types & Subjects
      case 'list_activity_types': {
        const types = await base44.entities.ActivityType.list();
        return { content: [{ type: 'text', text: JSON.stringify(types, null, 2) }] };
      }

      case 'list_activity_subjects': {
        const subjects = await base44.entities.ActivitySubject.list();
        return { content: [{ type: 'text', text: JSON.stringify(subjects, null, 2) }] };
      }

      // Analytics
      case 'list_analyses': {
        const analyses = await base44.entities.Analysis.list();
        let filtered = analyses;
        if (args.visibility) {
          filtered = filtered.filter(a => a.visibility === args.visibility);
        }
        if (args.isTemplate !== undefined) {
          filtered = filtered.filter(a => a.is_template === args.isTemplate);
        }
        return { content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }] };
      }

      case 'get_analysis': {
        const analysis = await base44.entities.Analysis.get(args.analysisId);
        return { content: [{ type: 'text', text: JSON.stringify(analysis, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
      isError: true
    };
  }
});

// ─── Server Startup ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MyKumpare MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});