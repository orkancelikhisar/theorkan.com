// 10 hand-authored ASCII pieces for the gallery. Each piece is a small
// monochrome composition. Titles and dates reference orkan's portfolio
// directories under ~/projects but the works themselves are originals
// authored for this OS — placeholders until/unless orkan drops in real
// renderings later.

export interface GalleryWork {
  title: string;
  year: string;
  caption: string;
  art: string;
}

export const WORKS: GalleryWork[] = [
  {
    title: 'Harbor at 4am',
    year: '2023',
    caption: 'minimal. waiting for wind.',
    art: String.raw`
                                                          .
                                                          |
                                                         /|
                                                        / |
                                                       /  |
                                                      /   |
                                                  ___/____|___
            .                                    /            \
                                                /              \
   ~  ~~   ~  ~~  ~~~  ~ ~  ~~  ~~  ~~  ~  ~~ ~~ ~~ ~~ ~ ~~ ~~~ ~ ~~  ~~  ~~
~~ ~~~  ~~~~  ~~ ~~ ~  ~~~  ~~  ~ ~~~ ~~ ~~~  ~ ~~  ~~  ~~ ~~~ ~~~  ~~~ ~~ ~
 ~~~  ~~  ~~  ~~~ ~~ ~~~~  ~  ~~ ~~~  ~~ ~  ~~~ ~~ ~~~ ~~~  ~~ ~~  ~~~  ~~~~
~~~ ~~~ ~~~  ~~~  ~~  ~~ ~~~ ~~~ ~~  ~~~ ~~~  ~~ ~ ~~ ~~~ ~~  ~~~ ~~ ~~~ ~`,
  },
  {
    title: 'Latent Walk I',
    year: '2022',
    caption: 'istanbul, generative series. seeded by a tuesday.',
    art: String.raw`
   .  ´  ' ,   .   ´  ,   .   '  ´  .   '   .   ,   .   ´
 ´   .   '   ,  .   ´   .  '   ,  .   ´   ,   '  .   ´   ,
   ´   .  '   ;   .  ,  ´   .   ,  ´  .  ;   '  ´   .   '
 ,  .   ,    ' ,   :   ;   ,   ;  :   ,  '   ;   .   ,  ,
   ´   '   ,   :   ;    :    ;   :    ;  ,  ´   ,  '   ´
 .   ,  ´  ;   :    ╱     ╲    :   ;  ´   '   .  ,   .  ´
   ;  .   ,   :   ╱   ◦     ╲   :  ,   ;   ´   ;   ,   ´
 '   .  ´   ,   ╱   o    .    ╲   ,  '   .   ,   ´   .
   ,  ´   ;   ╱   .    o    '    ╲  ;  ´   ,  '   ;   ´
 .   ,  ´  ,   :   ;   :    ,    '   ;  :   ;   ´   ,   '
   ´   .  '   ,   :  ;  ´   .   ;  ´  :  ,   ´   .   ,
 ´   .   '   ,  .   :   .  '   ,  .   ´   ,   '  .   ´   ,
   .  ´  ' ,   .   ´  ,   .   '  ´  .   '   .   ,   .   ´`,
  },
  {
    title: 'Currency Experiment, panel 3',
    year: '2024',
    caption: 'all the units, struck through.',
    art: String.raw`
    ┌─────────────────────────────────────────────────────────┐
    │                                                         │
    │   ₺      $      €      ¥      ₿      ₽      ₹      ฿   │
    │   ─      ─      ─      ─      ─      ─      ─      ─   │
    │                                                         │
    │   $      €      ¥      ₿      ₽      ₹      ฿      ₺   │
    │   ─      ─      ─      ─      ─      ─      ─      ─   │
    │                                                         │
    │   €      ¥      ₿      ₽      ₹      ฿      ₺      $   │
    │   ─      ─      ─      ─      ─      ─      ─      ─   │
    │                                                         │
    │   ¥      ₿      ₽      ₹      ฿      ₺      $      €   │
    │   ─      ─      ─      ─      ─      ─      ─      ─   │
    │                                                         │
    │              none of these are real money.              │
    │                                                         │
    └─────────────────────────────────────────────────────────┘`,
  },
  {
    title: 'Three Sails',
    year: '2023',
    caption: 'a regatta you almost won.',
    art: String.raw`
                            .
                           /|
                          / |
                         /  |              .
                        /   |             /|
                       /    |            / |
                      /     |           /  |        .
                     /______|          /   |       /|
                    /       |         /    |      / |
                   /        |        /     |     /  |
                  /         |       /______|    /   |
                  ----------         |   |     /    |
                                     |   |    /     |
                                     |   |   /______|
                                     ----    |   |
                                              |   |
                                              ----
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 ~ ~~ ~~~ ~~ ~~~ ~ ~~ ~~ ~~~ ~ ~~ ~~~ ~~ ~ ~~ ~~~ ~~ ~ ~~ ~~~ ~~ ~~ ~ ~~ ~
~~~ ~ ~~ ~~~ ~~ ~~ ~ ~~~ ~~ ~~~ ~~ ~~ ~ ~~~ ~~ ~~ ~~~ ~~ ~ ~~ ~~~ ~~ ~~ ~~~`,
  },
  {
    title: 'Zero Bytes',
    year: '2024',
    caption: 'one filled cell. the rest is the work.',
    art: String.raw`
   . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
   . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
   . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
   . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
   . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
   . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
   . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
   . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
   . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
   . . . . . . . . . . . . . . . . . . ▓ . . . . . . . . . .
   . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
   . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
   . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
   . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
   . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
   . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
   . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
   . . . . . . . . . . . . . . . . . . . . . . . . . . . . .`,
  },
  {
    title: 'Rope, Knotted',
    year: '2022',
    caption: 'a bowline, the only knot worth learning.',
    art: String.raw`
                  ____
                 /    \
                /      \
               |    ____|____
               |   /    .    \
                \_/    /|\    \
                  \   / | \   /
                   \_/  |  \_/
                        |
                        |
                        |
                        |
                        |
                        |
                        |
                        |__________________________________________________`,
  },
  {
    title: 'The Stowaway',
    year: '2024',
    caption: 'he is in the corner of every photograph you have not seen.',
    art: String.raw`
   .                                                                    .
                                                                    .
                                                              .

                                                                 .

                                                                    .



                                                                       .



                                                                    .


                                                                .
                                                              .
                                                       .   /.\
                                                          /  \
                                                         /    \
                                                        '______'`,
  },
  {
    title: 'Salt Field',
    year: '2023',
    caption: 'the photograph after the photograph.',
    art: String.raw`
   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .
     .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .
   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .
     .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .
   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .
     .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .
   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .
     .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .
   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .
     .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .
   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .
     .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .
   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .`,
  },
  {
    title: 'Letter, Unsent',
    year: '2024',
    caption: 'still in the drawer. ledger 7 of 7.',
    art: String.raw`
   _______________________________________________________________
   |                                                             |
   |   dear ____________,                                        |
   |                                                             |
   |   i think about tuesday more than is reasonable. you wore   |
   |   the lighter coat. we did not say anything about it.       |
   |                                                             |
   |   if you read this you will know it was for you. if you     |
   |   do not read this it is still for you. so. either way.     |
   |                                                             |
   |                                          ─ ___________      |
   |_____________________________________________________________|`,
  },
  {
    title: 'Artificial Gallery (floor plan)',
    year: '2024',
    caption: 'three rooms. one visitor.',
    art: String.raw`
   ┌──────────────────────────┬──────────────────────────────────┐
   │                          │                                  │
   │    ROOM I                │    ROOM II                       │
   │    "harbor works"        │    "currency works"              │
   │                          │                                  │
   │      ▓     ▓     ▓       │       ▓        ▓                 │
   │                          │                                  │
   │                          │       ▓        ▓                 │
   │      ▓     ▓     ▓       │                                  │
   │                          │                                  │
   ├──────────────────────────┴──────────┐                       │
   │                                     │                       │
   │   ROOM III  "latent walk"           │                       │
   │                                     │                       │
   │   ▓   ▓   ▓   ▓   ▓   ▓             │       ▓        ▓      │
   │                                     │                       │
   │   ▓   ▓   ▓   ▓   ▓   ▓             │                       │
   │                                     │     ◦                 │
   └─────────────────────────────────────┴───────────────────────┘
                                              (visitor)`,
  },
];
