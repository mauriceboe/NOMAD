import { authHandlers } from './auth';
import { settingsHandlers } from './settings';
import { addonHandlers } from './addons';
import { notificationHandlers } from './notifications';
import { vacayHandlers } from './vacay';
import { tripsHandlers } from './trips';
import { placesHandlers } from './places';
import { assignmentsHandlers } from './assignments';
import { packingHandlers } from './packing';
import { todoHandlers } from './todo';
import { budgetHandlers } from './budget';
import { reservationsHandlers } from './reservations';
import { filesHandlers } from './files';
import { tagsHandlers } from './tags';
import { dayNotesHandlers } from './dayNotes';
import { adminHandlers } from './admin';
import { sharedHandlers } from './shared';

export const defaultHandlers = [
  ...authHandlers,
  ...settingsHandlers,
  ...addonHandlers,
  ...notificationHandlers,
  ...vacayHandlers,
  ...tripsHandlers,
  ...placesHandlers,
  ...assignmentsHandlers,
  ...packingHandlers,
  ...todoHandlers,
  ...budgetHandlers,
  ...reservationsHandlers,
  ...filesHandlers,
  ...tagsHandlers,
  ...dayNotesHandlers,
  ...adminHandlers,
  ...sharedHandlers,
];
