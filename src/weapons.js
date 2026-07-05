// ============================================================
//  GPL Online — Weapon Definitions
// ============================================================

export const WEAPONS = {
  chapaat: {
    id:         'chapaat',
    name:       'Chapaat',
    label:      'Bare Hand',
    emoji:      '🖐️',
    color:      '#F59E0B',
    animClass:  'weapon-slap',
    power:      1,
    description: 'Old reliable — the classic open-palm slap!',
    impactEmoji: '💥',
    impactTexts: ['SLAP!', 'CHAP!', 'PAT!'],
  },
  chappal: {
    id:         'chappal',
    name:       'Chappal',
    label:      'Slipper',
    emoji:      '🩴',
    color:      '#8B5CF6',
    animClass:  'weapon-flip',
    power:      2,
    description: 'The Indian engineering classic!',
    impactEmoji: '⭐',
    impactTexts: ['THWACK!', 'SMACK!', 'WHAP!'],
  },
  belt: {
    id:         'belt',
    name:       'Belt',
    label:      'Belt',
    emoji:      '🎗️',
    color:      '#6B7280',
    animClass:  'weapon-whip',
    power:      3,
    description: 'Leather precision strike!',
    impactEmoji: '⚡',
    impactTexts: ['CRACK!', 'WHIP!', 'SNAP!'],
  },
  bat: {
    id:         'bat',
    name:       'Cricket Bat',
    label:      'Cricket Bat',
    emoji:      '🏏',
    color:      '#22C55E',
    animClass:  'weapon-swing',
    power:      4,
    description: 'For when you mean serious business!',
    impactEmoji: '🌟',
    impactTexts: ['THWONK!', 'CRACK!', 'SIX!'],
  },
  hammer: {
    id:         'hammer',
    name:       'Hammer',
    label:      'Hammer',
    emoji:      '🔨',
    color:      '#EF4444',
    animClass:  'weapon-slam',
    power:      5,
    description: 'Maximum destruction mode!',
    impactEmoji: '💫',
    impactTexts: ['BONK!', 'SLAM!', 'KA-BOOM!'],
  },
  boot: {
    id:         'boot',
    name:       'Boot Kick',
    label:      'Boot Kick',
    emoji:      '👟',
    color:      '#3B82F6',
    animClass:  'weapon-kick',
    power:      3,
    description: 'Straight from the football ground!',
    impactEmoji: '💢',
    impactTexts: ['KICK!', 'THUD!', 'BOOM!'],
  },
};

export const WEAPON_ORDER = ['chapaat', 'chappal', 'belt', 'bat', 'hammer', 'boot'];

export function getWeapon(id) {
  return WEAPONS[id] || WEAPONS.chapaat;
}

export function getImpactText(weaponId) {
  const w = getWeapon(weaponId);
  return w.impactTexts[Math.floor(Math.random() * w.impactTexts.length)];
}
