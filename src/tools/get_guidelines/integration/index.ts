import { Framework } from '../../../types.js';

import { getReactGuide } from './react.js';
import { getNativeGuide } from './native.js';
import { getAngularGuide } from './angular.js';

const integrationGuides: Record<Framework, () => string> = {
    react: getReactGuide,
    native: getNativeGuide,
    angular: getAngularGuide,
};

const getIntegrationGuide = (framework: Framework) => {
    return integrationGuides[framework]();
};

export { getIntegrationGuide };