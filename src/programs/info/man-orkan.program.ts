import type { Program } from '../../kernel/program';

const prog: Program = {
  name: 'man-orkan',
  manpage: 'man orkan — biographical manpage.',
  category: 'info',
  mode: 'inline',
  onCommand: () => [
    'ORKAN(1)                  theOrkan.OS Manual                  ORKAN(1)',
    '',
    'NAME',
    '    orkan — Orkan Çelikhisar.',
    '',
    'SYNOPSIS',
    '    orkan [project] [year]',
    '',
    'DESCRIPTION',
    '    Engineer (TUM, Boğaziçi), artist, musician, sailor.',
    '    Co-founder of wearefakt.com. Launched baldyapp.com.',
    '    3rd place skipper, Arkas Aegean Regatta 2024.',
    '',
    'DEPRECATED VALUES (see /etc/orkan.conf)',
    '    passion=enabled              # rejected by current build',
    '    philosophy_daemon=on         # disabled at user request',
    '    romanticism=safe_mode        # not honored',
    '',
    'SEE ALSO',
    '    projects(1), contact(1), whois(1) postmodern_dilenci.',
    '',
  ].join('\n'),
};

export default prog;
