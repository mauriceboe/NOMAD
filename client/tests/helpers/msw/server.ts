import { setupServer } from 'msw/node';
import { defaultHandlers } from './handlers';

export const server = setupServer(...defaultHandlers);
