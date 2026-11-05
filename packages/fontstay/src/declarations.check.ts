import type * as declared from '../index';
import type * as implemented from './index';

export type Declared = typeof declared;
export const implementation: Declared = null as unknown as typeof implemented;
