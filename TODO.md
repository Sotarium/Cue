# Sotarium TODO

## App shell and navigation
- [ ] Render a responsive left rail with Sotarium branding, New task action, and the navigation labels Computers, Agents, Library, Creations, Automations, Plugins, and More.
- [ ] Keep Agents visibly active and allow the user to switch sections with contextual content and toast feedback.

## Agents workspace
- [ ] Render the Agents page title, explanatory copy, search control, filters, view toggle, and Create agent CTA.
- [ ] Render a data-driven set of agent cards with role, model, run count, status, and last-used metadata.
- [ ] Filter agents by search text and favorites; show a useful empty state when no cards match.

## Agent detail and editing
- [ ] Open a contextual detail drawer from an agent card with overview, instructions, and activity tabs.
- [ ] Support an edit mode with editable name, description, and instructions plus save feedback.
- [ ] Support Run agent, Favorite, and close drawer interactions.

## Create flow and workspace settings
- [ ] Provide a create-agent modal with name, role, model, and instruction fields.
- [ ] Add the new agent to the workspace after creation and select it.
- [ ] Provide workspace settings content with notification, private workspace, and compact mode toggles.

## Quality
- [ ] Preserve readable responsive layouts for desktop and mobile widths.
- [ ] Serve `public/manus-routes.json` with the app route declaration.
- [ ] Run the production build and verify the dev server responds successfully.
