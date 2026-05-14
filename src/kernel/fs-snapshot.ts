import type { FSSnapshot } from './fs-types';

const DEFAULT_MTIME = Date.UTC(2026, 4, 14);

const dir = (children: Record<string, FSSnapshot>, mtime = DEFAULT_MTIME): FSSnapshot => ({
  type: 'dir', children, meta: { owner: 'orkan', group: 'orkan', perms: 'drwxr-xr-x', mtime },
});
const file = (content: string, mtime = DEFAULT_MTIME): FSSnapshot => ({
  type: 'file', content, meta: { owner: 'orkan', group: 'orkan', perms: '-rw-r--r--', mtime, size: content.length },
});
const hidden = (content: string, mtime = DEFAULT_MTIME): FSSnapshot => ({
  type: 'file', content, meta: { owner: 'orkan', group: 'orkan', perms: '-rw-------', mtime, size: content.length },
});

export const SNAPSHOT: FSSnapshot = dir({
  bin: dir({}),
  dev: dir({}),
  etc: dir({
    'orkan.conf': file([
      '# theOrkan.OS — system config',
      'hostname=theorkan',
      'user=orkan',
      'shell=/bin/orksh',
      '# (3 deprecated values intentionally omitted. see `man orkan`.)',
    ].join('\n')),
    motd: file('today the sea is restless. some files breathe.\ntry `hints` if you are lost.'),
    hostname: file('theorkan'),
  }),
  home: dir({
    orkan: dir({
      projects: dir({
        orbis_cognitio: dir({
          'README.txt': file('Large-scale dynamic socioeconomic model. Istanbul, 2023.\nBuilt with academics from Industrial Engineering, Sociology, Political Sciences.'),
        }),
        fakt: dir({
          'README.txt': file('Co-founded wearefakt.com. See: https://wearefakt.com'),
        }),
        baldy: dir({
          'README.txt': file('Launched baldyapp.com on iOS.'),
        }),
        regatta: dir({
          'README.txt': file('Arkas Aegean Link Regatta — 3rd place skipper.\nIzmir, Turkey. July 2024. 5-day race.'),
          log_day_03: file('day three. wind from the north. drifting.\nthe crew is tired but in good spirits.'),
          'wind.txt': file('NNW 4kt, building to 6 by afternoon.'),
        }),
        zero_bytes: dir({
          'README.txt': file('Founding member of Zero Bytes Foundation.\nCreative collective. https://zerobytes.foundation'),
        }),
        artificial_gallery: dir({
          'README.txt': file('@art.ificialgallery — online art gallery, 2020.\n3k+ active users. Recognition from international galleries.'),
        }),
        latent_walk: dir({
          'README.txt': file('Istanbul Latent Walk — publication, ArtDog Istanbul, 2020.\nhttps://artdogistanbul.com/teknoloji-ile-istanbul-bulusursa/'),
        }),
        currency_experiment: dir({
          'README.txt': file('Currency — Experiment. Research on the visual stimulant of "value"\nvia ML / evolutionary psychology lens. Istanbul, 2022.'),
        }),
        rotaract: dir({
          'README.txt': file('Rotaract Art Exhibition, Izmir, 2021.\nA.I. Depth Sensor + Particles Simulation. Online + on-venue.'),
        }),
        top100_seoul: dir({
          'README.txt': file('ArtsCloud Digital Art Fair Global — Top 100 Artist Award.\nSeoul, Korea — Understand Avenue, January 2022.\nIndividual AI artworks exhibited and auctioned as NFTs.'),
        }),
        tum_thesis: dir({
          'README.txt': file('M.Sc. Management & Technology, TU München.\nCompleted in 3 semesters instead of 4.'),
        }),
        dilenci: dir({
          readme: file('i was once alive. orkan put me here.'),
          'manifesto.txt': file('// placeholder — populated in v0.3'),
          'last_post.txt': file('// placeholder — populated in v0.3'),
          'photo.ascii': file('// placeholder — populated in v0.3'),
          'todo.txt': file('// placeholder — populated in v0.3'),
        }),
      }),
      'notes.txt': file('a notebook. write here with `echo "..." > notes.txt`.'),
      readme: file('welcome.\n\ntry `help` for the catalogue.\ntry `hints` if you feel lost.\ntry `motd` for today.'),
      '.bash_history': hidden([
        'ls projects/regatta/',
        'cat /dev/heart',
        'man harbor',
        'cat /var/regret/2024_04_18',
        'cowsay "ineği gördüm"',
        'fortune',
        'cat ~/projects/dilenci/readme',
        'whois postmodern_dilenci',
      ].join('\n')),
      '.dilenci': dir({
        'ledger.txt': hidden(''),
        'last_words.txt': hidden(''),
      }),
      '.istanbul': dir({
        'note.txt': hidden('a directory. it might fill later.'),
      }),
      '.dreams': dir({
        'fragments.txt': hidden('// scattered, intentional fragments.'),
      }),
    }),
  }),
  usr: dir({
    share: dir({
      poems: dir({
        'index.txt': file('these may grow as he is fed.\nsee also: ~/.dilenci/ledger.txt'),
      }),
      ascii: dir({}),
      fortunes: dir({
        'general.txt': file([
          'the wind shifts.',
          'a small thing is still a thing.',
          'salt remembers what water forgets.',
        ].join('\n---\n')),
      }),
    }),
  }),
  var: dir({
    log: dir({
      'system.log': file([
        '[boot] theOrkan.OS started',
        '[boot] 47 files indexed',
        '[boot] 117 deferred postmodern_dilenci (he sleeps)',
      ].join('\n')),
      'whispers.log': file(''),
      'observers.log': file('the stowaway is here.\nhe watches what your browser says about you.\nsee: pinpoint'),
    }),
    regret: dir({
      '2024_04_18': file('the things i did not write.'),
      '2024_11_02': file('a phone call i did not return.'),
      '2025_01_07': file('the song i had in my head for a week.'),
    }),
  }),
});
