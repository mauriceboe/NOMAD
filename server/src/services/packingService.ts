import { db, canAccessTrip } from '../db/database';

const BAG_COLORS = ['#6366f1', '#ec4899', '#f97316', '#10b981', '#06b6d4', '#8b5cf6', '#ef4444', '#f59e0b'];

type TripAccess = { id: number; user_id: number };

type PackingItemRow = {
  id: number;
  trip_id: number;
  user_id: number;
  name: string;
  checked: number;
  category: string | null;
  weight_grams: number | null;
  bag_id: number | null;
  sort_order: number;
  created_at: string;
};

type PackingBagRow = {
  id: number;
  trip_id: number;
  user_id: number;
  name: string;
  color: string;
  weight_limit_grams: number | null;
  sort_order: number;
  created_at: string;
};

interface ImportItem {
  name?: string;
  checked?: boolean;
  category?: string;
  weight_grams?: string | number;
  bag?: string;
}

function selectItemById(id: string | number) {
  return db.prepare('SELECT * FROM packing_items WHERE id = ?').get(id) as PackingItemRow | undefined;
}

function selectBagById(id: string | number) {
  return db.prepare('SELECT * FROM packing_bags WHERE id = ?').get(id) as PackingBagRow | undefined;
}

function getItemForMutation(tripId: string | number, id: string | number, userId: number) {
  return db.prepare(`
    SELECT *
    FROM packing_items
    WHERE id = ? AND trip_id = ? AND user_id = ?
  `).get(id, tripId, userId) as PackingItemRow | undefined;
}

function getBagForMutation(tripId: string | number, bagId: string | number, userId: number) {
  return db.prepare(`
    SELECT *
    FROM packing_bags
    WHERE id = ? AND trip_id = ? AND user_id = ?
  `).get(bagId, tripId, userId) as PackingBagRow | undefined;
}

function nextItemSortOrder(tripId: string | number, userId: number) {
  const row = db.prepare(
    'SELECT MAX(sort_order) as max FROM packing_items WHERE trip_id = ? AND user_id = ?'
  ).get(tripId, userId) as { max: number | null };
  return (row.max ?? -1) + 1;
}

function nextBagSortOrder(tripId: string | number, userId: number) {
  const row = db.prepare(
    'SELECT MAX(sort_order) as max FROM packing_bags WHERE trip_id = ? AND user_id = ?'
  ).get(tripId, userId) as { max: number | null };
  return (row.max ?? -1) + 1;
}

function listTemplateItems(templateId: string | number) {
  return db.prepare(`
    SELECT ti.name, tc.name as category
    FROM packing_template_items ti
    JOIN packing_template_categories tc ON ti.category_id = tc.id
    WHERE tc.template_id = ?
    ORDER BY tc.sort_order, ti.sort_order, ti.id
  `).all(templateId) as { name: string; category: string }[];
}

function resolveBagIdByName(tripId: string | number, userId: number, bagName: string | undefined) {
  if (!bagName?.trim()) return null;

  const normalizedName = bagName.trim();
  const existing = db.prepare(`
    SELECT id
    FROM packing_bags
    WHERE trip_id = ? AND user_id = ? AND name = ?
  `).get(tripId, userId, normalizedName) as { id: number } | undefined;

  if (existing) return existing.id;

  const bagCount = (db.prepare(
    'SELECT COUNT(*) as c FROM packing_bags WHERE trip_id = ? AND user_id = ?'
  ).get(tripId, userId) as { c: number }).c;

  const created = db.prepare(`
    INSERT INTO packing_bags (trip_id, user_id, name, color, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(tripId, userId, normalizedName, BAG_COLORS[bagCount % BAG_COLORS.length], nextBagSortOrder(tripId, userId));

  return Number(created.lastInsertRowid);
}

function getTemplateById(templateId: string | number, userId: number) {
  return db.prepare(`
    SELECT *
    FROM packing_templates
    WHERE id = ?
      AND (is_global = 1 OR created_by = ?)
  `).get(templateId, userId) as { id: number } | undefined;
}

export function verifyTripAccess(tripId: string | number, userId: number) {
  return canAccessTrip(tripId, userId) as TripAccess | undefined;
}

export function listItems(tripId: string | number) {
  return db.prepare(`
    SELECT pi.*, u.username as owner_name, u.avatar as owner_avatar
    FROM packing_items pi
    JOIN users u ON u.id = pi.user_id
    WHERE pi.trip_id = ?
    ORDER BY pi.user_id ASC, pi.sort_order ASC, pi.created_at ASC, pi.id ASC
  `).all(tripId);
}

export function createItem(
  tripId: string | number,
  userId: number,
  data: { name: string; category?: string; checked?: boolean; weight_grams?: number | null; bag_id?: number | null }
) {
  const sortOrder = nextItemSortOrder(tripId, userId);
  const bagId = data.bag_id ?? null;

  if (bagId !== null && !getBagForMutation(tripId, bagId, userId)) {
    return null;
  }

  const result = db.prepare(`
    INSERT INTO packing_items (trip_id, user_id, name, checked, category, weight_grams, bag_id, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tripId,
    userId,
    data.name.trim(),
    data.checked ? 1 : 0,
    data.category?.trim() || 'Other',
    data.weight_grams ?? null,
    bagId,
    sortOrder
  );

  return selectItemById(result.lastInsertRowid);
}

export function updateItem(
  tripId: string | number,
  id: string | number,
  userId: number,
  data: { name?: string; checked?: number; category?: string; weight_grams?: number | null; bag_id?: number | null },
  bodyKeys: string[]
) {
  const item = getItemForMutation(tripId, id, userId);
  if (!item) return null;

  if (bodyKeys.includes('bag_id') && data.bag_id !== null && data.bag_id !== undefined && !getBagForMutation(tripId, data.bag_id, userId)) {
    return null;
  }

  db.prepare(`
    UPDATE packing_items SET
      name = COALESCE(?, name),
      checked = CASE WHEN ? IS NOT NULL THEN ? ELSE checked END,
      category = COALESCE(?, category),
      weight_grams = CASE WHEN ? THEN ? ELSE weight_grams END,
      bag_id = CASE WHEN ? THEN ? ELSE bag_id END
    WHERE id = ?
  `).run(
    data.name?.trim() || null,
    data.checked !== undefined ? 1 : null,
    data.checked ? 1 : 0,
    data.category?.trim() || null,
    bodyKeys.includes('weight_grams') ? 1 : 0,
    data.weight_grams ?? null,
    bodyKeys.includes('bag_id') ? 1 : 0,
    data.bag_id ?? null,
    id
  );

  return selectItemById(id);
}

export function deleteItem(tripId: string | number, id: string | number, userId: number) {
  const item = getItemForMutation(tripId, id, userId);
  if (!item) return false;
  db.prepare('DELETE FROM packing_items WHERE id = ?').run(id);
  return true;
}

export function bulkImport(tripId: string | number, userId: number, items: ImportItem[]) {
  let sortOrder = nextItemSortOrder(tripId, userId);
  const created: PackingItemRow[] = [];
  const insert = db.prepare(`
    INSERT INTO packing_items (trip_id, user_id, name, checked, category, weight_grams, bag_id, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const item of items) {
      if (!item.name?.trim()) continue;

      const bagId = resolveBagIdByName(tripId, userId, item.bag);
      const result = insert.run(
        tripId,
        userId,
        item.name.trim(),
        item.checked ? 1 : 0,
        item.category?.trim() || 'Other',
        item.weight_grams ? parseInt(String(item.weight_grams), 10) || null : null,
        bagId,
        sortOrder++
      );
      const createdItem = selectItemById(result.lastInsertRowid);
      if (createdItem) created.push(createdItem);
    }
  });

  transaction();
  return created;
}

export function listBags(tripId: string | number) {
  return db.prepare(`
    SELECT pb.*, u.username as owner_name, u.avatar as owner_avatar
    FROM packing_bags pb
    JOIN users u ON u.id = pb.user_id
    WHERE pb.trip_id = ?
    ORDER BY pb.user_id ASC, pb.sort_order ASC, pb.id ASC
  `).all(tripId);
}

export function createBag(tripId: string | number, userId: number, data: { name: string; color?: string }) {
  const result = db.prepare(`
    INSERT INTO packing_bags (trip_id, user_id, name, color, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    tripId,
    userId,
    data.name.trim(),
    data.color || '#6366f1',
    nextBagSortOrder(tripId, userId)
  );

  return selectBagById(result.lastInsertRowid);
}

export function updateBag(
  tripId: string | number,
  bagId: string | number,
  userId: number,
  data: { name?: string; color?: string; weight_limit_grams?: number | null }
) {
  const bag = getBagForMutation(tripId, bagId, userId);
  if (!bag) return null;

  db.prepare(`
    UPDATE packing_bags SET
      name = COALESCE(?, name),
      color = COALESCE(?, color),
      weight_limit_grams = ?
    WHERE id = ?
  `).run(data.name?.trim() || null, data.color || null, data.weight_limit_grams ?? null, bagId);

  return selectBagById(bagId);
}

export function deleteBag(tripId: string | number, bagId: string | number, userId: number) {
  const bag = getBagForMutation(tripId, bagId, userId);
  if (!bag) return false;
  db.prepare('DELETE FROM packing_bags WHERE id = ?').run(bagId);
  return true;
}

export function listAvailableTemplates(userId: number) {
  return db.prepare(`
    SELECT pt.*, u.username as created_by_name,
      (SELECT COUNT(*)
       FROM packing_template_items ti
       JOIN packing_template_categories tc ON ti.category_id = tc.id
       WHERE tc.template_id = pt.id) as item_count
    FROM packing_templates pt
    JOIN users u ON pt.created_by = u.id
    WHERE pt.is_global = 1 OR pt.created_by = ?
    ORDER BY pt.is_global DESC, pt.created_at DESC, pt.id DESC
  `).all(userId);
}

export function saveTripItemsAsTemplate(tripId: string | number, userId: number, name: string) {
  const templateName = name.trim();
  if (!templateName) return null;

  const items = db.prepare(`
    SELECT category, name
    FROM packing_items
    WHERE trip_id = ? AND user_id = ?
    ORDER BY sort_order ASC, created_at ASC, id ASC
  `).all(tripId, userId) as { category: string | null; name: string }[];

  if (items.length === 0) return null;

  const createTemplate = db.prepare(`
    INSERT INTO packing_templates (name, created_by, is_global)
    VALUES (?, ?, 0)
  `);
  const createCategory = db.prepare(`
    INSERT INTO packing_template_categories (template_id, name, sort_order)
    VALUES (?, ?, ?)
  `);
  const createItem = db.prepare(`
    INSERT INTO packing_template_items (category_id, name, sort_order)
    VALUES (?, ?, ?)
  `);

  let templateId = 0;
  const transaction = db.transaction(() => {
    const templateResult = createTemplate.run(templateName, userId);
    templateId = Number(templateResult.lastInsertRowid);

    const grouped = new Map<string, string[]>();
    for (const item of items) {
      const category = item.category?.trim() || 'Other';
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category)!.push(item.name);
    }

    let categoryOrder = 0;
    for (const [categoryName, categoryItems] of grouped.entries()) {
      const categoryResult = createCategory.run(templateId, categoryName, categoryOrder++);
      const categoryId = Number(categoryResult.lastInsertRowid);
      categoryItems.forEach((itemName, itemOrder) => {
        createItem.run(categoryId, itemName, itemOrder);
      });
    }
  });

  transaction();
  return db.prepare('SELECT * FROM packing_templates WHERE id = ?').get(templateId);
}

export function applyTemplate(tripId: string | number, userId: number, templateId: string | number) {
  const template = getTemplateById(templateId, userId);
  if (!template) return null;

  const templateItems = listTemplateItems(templateId);
  if (templateItems.length === 0) return null;

  let sortOrder = nextItemSortOrder(tripId, userId);
  const insert = db.prepare(`
    INSERT INTO packing_items (trip_id, user_id, name, checked, category, sort_order)
    VALUES (?, ?, ?, 0, ?, ?)
  `);
  const added: PackingItemRow[] = [];

  const transaction = db.transaction(() => {
    for (const templateItem of templateItems) {
      const result = insert.run(tripId, userId, templateItem.name, templateItem.category, sortOrder++);
      const item = selectItemById(result.lastInsertRowid);
      if (item) added.push(item);
    }
  });

  transaction();
  return added;
}

export function getCategoryAssignees(tripId: string | number) {
  const rows = db.prepare(`
    SELECT pca.category_name, pca.user_id, u.username, u.avatar
    FROM packing_category_assignees pca
    JOIN users u ON pca.user_id = u.id
    WHERE pca.trip_id = ?
  `).all(tripId);

  const assignees: Record<string, { user_id: number; username: string; avatar: string | null }[]> = {};
  for (const row of rows as any[]) {
    if (!assignees[row.category_name]) assignees[row.category_name] = [];
    assignees[row.category_name].push({ user_id: row.user_id, username: row.username, avatar: row.avatar });
  }

  return assignees;
}

export function updateCategoryAssignees(tripId: string | number, categoryName: string, userIds: number[] | undefined) {
  db.prepare('DELETE FROM packing_category_assignees WHERE trip_id = ? AND category_name = ?').run(tripId, categoryName);

  if (Array.isArray(userIds) && userIds.length > 0) {
    const insert = db.prepare('INSERT OR IGNORE INTO packing_category_assignees (trip_id, category_name, user_id) VALUES (?, ?, ?)');
    for (const userId of userIds) insert.run(tripId, categoryName, userId);
  }

  return db.prepare(`
    SELECT pca.user_id, u.username, u.avatar
    FROM packing_category_assignees pca
    JOIN users u ON pca.user_id = u.id
    WHERE pca.trip_id = ? AND pca.category_name = ?
  `).all(tripId, categoryName);
}

export function reorderItems(tripId: string | number, userId: number, orderedIds: number[]) {
  const update = db.prepare('UPDATE packing_items SET sort_order = ? WHERE id = ? AND trip_id = ? AND user_id = ?');
  const transaction = db.transaction((ids: number[]) => {
    ids.forEach((id, index) => {
      update.run(index, id, tripId, userId);
    });
  });
  transaction(orderedIds);
}
