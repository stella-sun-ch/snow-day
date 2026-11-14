// Register Hike Day without creating a circular import.
import { registerMode } from './modes.js';
import { planHikeDay, cleanHikeChoices } from './hikePlanner.js';

registerMode('hike', { cleanChoices: cleanHikeChoices, plan: planHikeDay });
