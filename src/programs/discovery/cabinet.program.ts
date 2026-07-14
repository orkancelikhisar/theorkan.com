import type { Program } from '../../kernel/program';
import { coastalSnapshot, readCoastalMemory } from '../../coast/coastal-memory';

const LABELS: Record<string, string> = {
  'rescued-line': 'a line caught by dilenci, still wet',
  'radio-frequency': 'a frequency written on the back of nothing',
  'undertow-line': 'something you gave the water',
  'studio-image': 'a visitor plate made from this session',
  'stowaway-name': 'the name of who boarded with you',
  'impossible-room': 'a key whose room is larger than its building',
};

const prog: Program = {
  name: 'cabinet',
  aliases: ['inventory', 'archive'],
  manpage: 'cabinet — open the drawer of things the coast allowed you to keep.',
  category: 'discovery',
  mode: 'inline',
  onCommand: () => {
    const memory = readCoastalMemory();
    const coast = coastalSnapshot(memory);
    const lines = ['the cabinet opens reluctantly.', ''];
    if (memory.artifacts.length === 0) lines.push('  the drawer contains only its own smell.');
    else for (const artifact of memory.artifacts) lines.push(`  · ${LABELS[artifact] ?? artifact}`);
    lines.push('');
    if (coast.departureReady) lines.push('the five necessary things are here. the boat knows.');
    else lines.push(`${coast.missingDepartureArtifacts.length} necessary absence${coast.missingDepartureArtifacts.length === 1 ? '' : 's'} remain.`);
    if (memory.phrases.length) {
      lines.push('', `under the drawer paper: “${memory.phrases[memory.phrases.length - 1].text}”`);
    }
    return lines.join('\n');
  },
};

export default prog;
