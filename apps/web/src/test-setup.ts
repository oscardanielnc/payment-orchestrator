import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Without Vitest globals, Testing Library cannot register its own cleanup.
afterEach(cleanup);

// Routes are lazy chunks: the first one a test visits is compiled on demand, which takes more
// than findBy's default 1 s on a cold CI runner.
configure({ asyncUtilTimeout: 5000 });
