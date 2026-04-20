# Packing Templates

Reuse packing lists across trips using pre-built templates.

<!-- TODO: screenshot: packing template list with categories and items -->

![Packing Templates](assets/PackingTemplate.png)

## Applying a template

In the Packing Lists panel, click the **Apply Template** button (shown with a package icon in the toolbar). A dropdown lists all available templates, each showing its name and item count. Click a template to apply it.

Applying a template copies all categories and items from the template into the current trip's packing list — existing items are not removed. Items are inserted with the same category names as defined in the template, so they appear alongside any existing items that share the same category name.

Requires the `packing_edit` permission.

The Apply Template button only appears when at least one template exists and you have edit permission.

## Saving the current list as a template

In the packing panel toolbar, click the **Save as template** button (folder-plus icon) when items exist in the list. An inline name input appears in the toolbar — type a name and press **Enter** or click the confirm button. The current trip's categories and items are saved as a new reusable template.

The Save as Template button only appears when there are items in the list and you have `packing_edit` permission.

> **Admin:** Templates are created and managed in [Admin-Packing-Templates](Admin-Packing-Templates). Each template has a three-level structure: template → categories → items.

## See also

- [Packing-Lists](Packing-Lists)
- [Admin-Packing-Templates](Admin-Packing-Templates)
