import { Database, Column, createDefaultView, createDefaultRow, genId, SELECT_COLORS } from './databaseModel';

function col(name: string, type: Column['type'], opts?: Partial<Column>): Column {
  return { id: genId(), name, type, ...opts };
}

function opt(label: string, idx: number) {
  return { id: genId(), label, color: SELECT_COLORS[idx % SELECT_COLORS.length] };
}

export interface DatabaseTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  create: () => Database;
}

function makeDb(title: string, columns: Column[], rowCount: number): Database {
  const view = createDefaultView('table');
  const now = new Date().toISOString();
  const rows = Array.from({ length: rowCount }, () => createDefaultRow(columns));
  return {
    id: genId(), title, columns, rows,
    views: [view], activeViewId: view.id,
    createdAt: now, updatedAt: now,
  };
}

export const DATABASE_TEMPLATES: DatabaseTemplate[] = [
  {
    id: 'project-tracker',
    name: 'Project Tracker',
    description: 'Track tasks, assignees, and deadlines',
    icon: '📋',
    create: () => {
      const cols = [
        col('Task', 'text'),
        col('Status', 'select', { options: [opt('To Do', 0), opt('In Progress', 3), opt('Done', 2)] }),
        col('Priority', 'select', { options: [opt('Low', 4), opt('Medium', 3), opt('High', 1)] }),
        col('Assignee', 'person'),
        col('Due Date', 'date'),
        col('Done', 'checkbox'),
      ];
      return makeDb('Project Tracker', cols, 3);
    },
  },
  {
    id: 'crm',
    name: 'CRM',
    description: 'Manage contacts and deals',
    icon: '🤝',
    create: () => {
      const cols = [
        col('Company', 'text'),
        col('Contact', 'person'),
        col('Email', 'email'),
        col('Website', 'url'),
        col('Stage', 'select', { options: [opt('Lead', 0), opt('Contacted', 3), opt('Proposal', 4), opt('Closed Won', 2), opt('Closed Lost', 1)] }),
        col('Value', 'number'),
      ];
      return makeDb('CRM', cols, 3);
    },
  },
  {
    id: 'inventory',
    name: 'Inventory',
    description: 'Track stock and products',
    icon: '📦',
    create: () => {
      const cols = [
        col('Item', 'text'),
        col('Category', 'select', { options: [opt('Electronics', 0), opt('Furniture', 3), opt('Supplies', 2)] }),
        col('Quantity', 'number'),
        col('Price', 'number'),
        col('In Stock', 'checkbox'),
      ];
      return makeDb('Inventory', cols, 3);
    },
  },
  {
    id: 'reading-list',
    name: 'Reading List',
    description: 'Track books, articles, and links',
    icon: '📚',
    create: () => {
      const cols = [
        col('Title', 'text'),
        col('Author', 'text'),
        col('URL', 'url'),
        col('Status', 'select', { options: [opt('To Read', 0), opt('Reading', 3), opt('Finished', 2)] }),
        col('Tags', 'multi-select', { options: [opt('Fiction', 4), opt('Non-Fiction', 0), opt('Tech', 5), opt('Business', 3)] }),
        col('Rating', 'number'),
      ];
      return makeDb('Reading List', cols, 3);
    },
  },
];
