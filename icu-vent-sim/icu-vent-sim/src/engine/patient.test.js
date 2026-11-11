import { describe, it, expect } from 'vitest';
import { predictedBodyWeight } from './patient.js';

describe('predictedBodyWeight', () => {
  it('男性 170 cm', () => expect(predictedBodyWeight(170, 'male')).toBeCloseTo(66.0, 1));
  it('女性 160 cm', () => expect(predictedBodyWeight(160, 'female')).toBeCloseTo(52.4, 1));
});
