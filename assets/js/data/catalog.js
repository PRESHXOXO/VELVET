export const API_KEY = 'AIzaSyBFlcDJ8UCnt7JnnAEC96fGDTwPvsapw1U';
export const API_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video';

export const stations = [
  {name:'90s R&B',query:'90s R&B hits',gradient:'linear-gradient(135deg,#1a0030,#3d0060)',seedIndexes:[0,1,3,4,8,10]},
  {name:'Neo Soul',query:'neo soul music',gradient:'linear-gradient(135deg,#1a1000,#3d2800)',seedIndexes:[10,11,5,6,7,0]},
  {name:'2000s R&B',query:'2000s R&B hits',gradient:'linear-gradient(135deg,#001a1a,#003d3d)',seedIndexes:[2,5,6,7,8,11]},
  {name:'Current R&B',query:'2024 R&B new music',gradient:'linear-gradient(135deg,#1a0008,#3d0018)',seedIndexes:[7,11,2,5,6,10]},
  {name:'Hip Hop Classics',query:'90s hip hop classics',gradient:'linear-gradient(135deg,#0a0a1a,#1a1a3d)',seedIndexes:[1,3,4,8,0,2]},
  {name:'Trap and Hip Hop',query:'trap hip hop 2024',gradient:'linear-gradient(135deg,#1a0a00,#3d1800)',seedIndexes:[7,2,5,6,1,8]},
  {name:'Slow Jams',query:'slow jams R&B',gradient:'linear-gradient(135deg,#100018,#280030)',seedIndexes:[5,6,10,11,0,8]},
  {name:'Girl Power',query:'female R&B pop hits',gradient:'linear-gradient(135deg,#1a0010,#3d0025)',seedIndexes:[1,3,4,10,7,11]},
  {name:'Throwback',query:'80s 90s throwback hits',gradient:'linear-gradient(135deg,#001010,#002828)',seedIndexes:[0,1,3,4,8,10]},
  {name:'Workout Hype',query:'workout hype music',gradient:'linear-gradient(135deg,#001a00,#003d00)',seedIndexes:[2,7,8,1,5,6]},
  {name:'Chill Vibes',query:'chill R&B vibes',gradient:'linear-gradient(135deg,#0a1020,#1a2040)',seedIndexes:[10,11,0,6,7,5]},
  {name:'Sunday Morning',query:'Sunday morning soul music',gradient:'linear-gradient(135deg,#1a1000,#302000)',seedIndexes:[10,11,0,5,6,3]},
  {name:'80s Soul',query:'80s soul r&b marvin gaye stevie wonder classic',gradient:'linear-gradient(135deg,#0d1a0d,#1a3a1a)',seedIndexes:[]},
  {name:'Whitney & Mariah',query:'whitney houston mariah carey 90s hits official audio',gradient:'linear-gradient(135deg,#1a0d1a,#3a1a3a)',seedIndexes:[]},
  {name:'Janet & En Vogue',query:'janet jackson en vogue 90s r&b official audio',gradient:'linear-gradient(135deg,#0d0d1a,#1a1a3a)',seedIndexes:[]},
  {name:'Hip Hop Soul',query:'mary j blige total faith 90s hip hop soul official audio',gradient:'linear-gradient(135deg,#1a001a,#38003a)',seedIndexes:[1,3,5]},
  {name:'Alicia & Beyoncé',query:'alicia keys beyonce r&b official audio hits',gradient:'linear-gradient(135deg,#1a1200,#3a2800)',seedIndexes:[]},
  {name:'2010s R&B',query:'the weeknd miguel bryson tiller 2010s r&b official audio',gradient:'linear-gradient(135deg,#001a0d,#003028)',seedIndexes:[]},
  {name:'Alt R&B',query:'frank ocean daniel caesar sza modern alternative r&b official',gradient:'linear-gradient(135deg,#001818,#002a2a)',seedIndexes:[]},
  {name:'Party Anthems',query:'early 2000s hip hop r&b party hits usher lil jon official audio',gradient:'linear-gradient(135deg,#1a0500,#3a1000)',seedIndexes:[2,7,8]}
];

export const seedSongs = [
  {title:'No Scrubs',artist:'TLC',videoId:'FrLequ6dUdM'},
  {title:'Say My Name',artist:'Destiny\'s Child',videoId:'sQgd6MccwZc'},
  {title:'Yeah!',artist:'Usher',videoId:'GxBSyx85Kp8'},
  {title:'So Sick',artist:'Ne-Yo',videoId:'IxszlJppRQI'},
  {title:'You Make Me Wanna...',artist:'Usher',videoId:'bQRzrnH6_HY'},
  {title:'Try Again',artist:'Aaliyah',videoId:'nEF_-IcnQC4'},
  {title:'Rock the Boat',artist:'Aaliyah',videoId:'A5AAcgtMjUI'},
  {title:'Family Affair',artist:'Mary J. Blige',videoId:'znlFu_lemsU'},
  {title:'I Believe I Can Fly',artist:'R. Kelly',videoId:'GIQn8pab8Vc'},
  {title:'I Wanna Be Down',artist:'Brandy',videoId:'PzpLkcfBe-A'},
  {title:'End of the Road',artist:'Boyz II Men',videoId:'zDKO6XYXioc'},
  {title:'If Your Girl Only Knew',artist:'Aaliyah',videoId:'v_Qy6vaMsFQ'}
];

var stationNotes = [
  {description:'Glossy hooks, crossover slow burns, and radio-built singalongs.',tags:['90s r&b','classics','slow jams']},
  {description:'Live-feeling instrumentation, grown-room pacing, and warmer low-end.',tags:['neo soul','grown and sexy','late night']},
  {description:'Polished hooks, ringtone-era confidence, and cleaner modern drums.',tags:['2000s r&b','club','slow jams']},
  {description:'A softer present-day lane with breakup records and conversational vocals.',tags:['current r&b','new music','mood']},
  {description:'Big personalities, foundational records, and crowd-tested energy.',tags:['hip hop classics','gold era','legendary']},
  {description:'Sharper drums, higher intensity, and quicker room temperature shifts.',tags:['trap','hype','workout']},
  {description:'The candles-down corner of the catalog: tenderness, tension, and replay value.',tags:['slow jams','love songs','midnight']},
  {description:'Women-led cuts with strong hooks, point-of-view, and swagger.',tags:['women of r&b','girl power','icons']},
  {description:'Shared-memory favorites built for instant recognition.',tags:['throwback','classics','nostalgia']},
  {description:'Quicker BPMs and choruses that feel physical the moment they drop.',tags:['workout','energy','upbeat']},
  {description:'Cooler textures and smoother delivery without losing melody.',tags:['chill vibes','drive','smooth']},
  {description:'Easy-start records for slow mornings, windows open, coffee on.',tags:['sunday morning','soul','easy listening']},
  {description:'Deep soul grooves and classic R&B from the golden era of Motown and beyond.',tags:['80s soul','classic','motown']},
  {description:'Two of the greatest voices in R&B history in one room.',tags:['icons','90s r&b','power ballads']},
  {description:'Dance-floor driven R&B and girl group energy from the peak 90s era.',tags:['90s r&b','dance','women of r&b']},
  {description:'Raw emotion, street poetry, and the sound that bridged hip hop and soul.',tags:['hip hop soul','90s','raw']},
  {description:'Two decades of hits from two of the most consistent forces in R&B.',tags:['2000s r&b','icons','women of r&b']},
  {description:'Atmospheric beats, falsetto runs, and a harder emotional edge.',tags:['2010s r&b','moody','new wave']},
  {description:'Minimal production, introspective writing, and the soft boundary of R&B.',tags:['alt r&b','current','introspective']},
  {description:'High-energy crossover records built for the dance floor and the radio at once.',tags:['party','club','2000s']}
];
var seedMeta = [
  {artistSlug:'tevin-campbell',year:'1993',tags:['90s r&b','new jack swing','slow jams']},
  {artistSlug:'tlc',year:'1999',tags:['90s r&b','women of r&b','girl groups']},
  {artistSlug:'usher',year:'2001',tags:['2000s r&b','club','male vocals']},
  {artistSlug:'destiny-s-child',year:'1999',tags:['90s r&b','women of r&b','girl groups']},
  {artistSlug:'aaliyah',year:'1994',tags:['90s r&b','women of r&b','swing']},
  {artistSlug:'queen-latifah',year:'1993',tags:['hip hop classics','women of r&b','rap classics']},
  {artistSlug:'ginuwine',year:'2001',tags:['2000s r&b','slow jams','male vocals']},
  {artistSlug:'ne-yo',year:'2006',tags:['2000s r&b','breakup songs','current r&b']},
  {artistSlug:'usher',year:'1997',tags:['90s r&b','slow jams','male vocals']},
  {artistSlug:'r-kelly',year:'1993',tags:['90s r&b','slow jams','midnight']},
  {artistSlug:'maxwell',year:'1999',tags:['neo soul','love songs','slow jams']},
  {artistSlug:'joe',year:'1999',tags:['neo soul','slow jams','male vocals']}
];

export const artistProfiles = {
  'aaliyah':{name:'Aaliyah',tagline:'Sleek, airy, and always a little ahead of the room.',bio:'Velvet uses Aaliyah to hold the cooler edge of 90s R&B: swing in the drums, softness in the delivery, and a silhouette that still feels modern.',gradient:'linear-gradient(135deg,#231329,#5f3059)',tags:['cool swing','after-hours','women of r&b']},
  'destiny-s-child':{name:'Destiny\'s Child',tagline:'Precision harmonies with a sharper point of view.',bio:'This profile anchors the group-driven side of the app: tightly stacked vocals, unforgettable hooks, and the kind of records that change the mood as soon as the chorus hits.',gradient:'linear-gradient(135deg,#1b1235,#6c2b58)',tags:['harmonies','girl groups','big hooks']},
  'ginuwine':{name:'Ginuwine',tagline:'Confident leads, glossy production, and late-night pacing.',bio:'Ginuwine sits in Velvet\'s smoother mid-tempo pocket, where every record feels built for dim lights, patient grooves, and a little extra charisma.',gradient:'linear-gradient(135deg,#102435,#2b5974)',tags:['mid-tempo','smooth','slow jams']},
  'joe':{name:'Joe',tagline:'Tender hooks and grown-man honesty.',bio:'Joe gives the catalog one of its most dependable romantic lanes: clean melodies, calm confidence, and songs that stay gentle without going soft.',gradient:'linear-gradient(135deg,#2d1608,#7b4a2d)',tags:['neo soul adjacent','romance','singer-songwriter feel']},
  'maxwell':{name:'Maxwell',tagline:'Rich harmonies, live-band warmth, and velvet pacing.',bio:'Maxwell is the bridge between classic soul elegance and the roomier side of neo soul, which is why his page feels like the center of the app\'s softer, warmer lane.',gradient:'linear-gradient(135deg,#24160d,#84533a)',tags:['neo soul','warm bass','grown room']},
  'ne-yo':{name:'Ne-Yo',tagline:'Precise pop-R&B writing with a breakup soundtrack edge.',bio:'When Velvet needs clean hooks and modern polish, Ne-Yo is the move. His profile is the polished side of the catalog: lean drums, direct lyrics, and instantly readable choruses.',gradient:'linear-gradient(135deg,#101f37,#2c5684)',tags:['2000s polish','breakup songs','radio gold']},
  'queen-latifah':{name:'Queen Latifah',tagline:'Authority, message, and cross-lane confidence.',bio:'Queen Latifah broadens the room beyond slow jams. Her page keeps the catalog rooted in hip hop history while still feeling at home beside R&B records with personality and weight.',gradient:'linear-gradient(135deg,#2b1111,#7b2d2d)',tags:['hip hop history','icons','statement records']},
  'r-kelly':{name:'R Kelly',tagline:'Midnight pacing and unmistakable early-90s slow jam structure.',bio:'This page reflects the quieter, more sensual lane of Velvet\'s catalog, focused on atmosphere, low lights, and records built to move slowly.',gradient:'linear-gradient(135deg,#20161d,#5f4456)',tags:['slow jams','midnight','90s r&b']},
  'tevin-campbell':{name:'Tevin Campbell',tagline:'Bright tenor, big choruses, and early-90s lift.',bio:'Tevin Campbell opens up the brighter side of the catalog with youthful urgency and polished new-jack swing energy that still feels warm inside the Velvet palette.',gradient:'linear-gradient(135deg,#2a1122,#7f3a5f)',tags:['new jack swing','bright hooks','90s essentials']},
  'tlc':{name:'TLC',tagline:'Playful delivery, iconic hooks, and attitude that still lands.',bio:'TLC represents the lighter-on-its-feet side of the room: records with bounce, personality, and enough edge to keep the catalog from feeling too uniform.',gradient:'linear-gradient(135deg,#182019,#466a43)',tags:['girl groups','attitude','classics']},
  'usher':{name:'Usher',tagline:'Pure star power across both club records and slow burns.',bio:'Usher is one of Velvet\'s connective tissues. He links late-90s smoothness to 2000s polish, which makes his profile the easiest bridge between stations, moods, and eras.',gradient:'linear-gradient(135deg,#131c2f,#385b7d)',tags:['star power','club to slow jam','essential']},
  'whitney-houston':{name:'Whitney Houston',tagline:'The greatest voice in pop and R&B history.',bio:'Whitney Houston defines the power ballad and the vocal acrobat in one artist. Her catalog spans gospel-rooted soul, radio R&B, and cinematic pop without ever losing the warmth.',gradient:'linear-gradient(135deg,#2a1535,#6b3a7a)',tags:['icons','90s r&b','power ballads']},
  'mariah-carey':{name:'Mariah Carey',tagline:'Whistle notes, hip hop crossovers, and timeless hooks.',bio:'Mariah sits at the center of 90s pop-R&B and defined what a superstar crossover could sound like — massive production, unmistakable runs, and a range nobody has matched.',gradient:'linear-gradient(135deg,#1a0d28,#4a2a6a)',tags:['90s r&b','classics','pop crossover']},
  'janet-jackson':{name:'Janet Jackson',tagline:'Control, rhythm, and a decade of defining records.',bio:'Janet Jackson shaped the sound and look of 90s R&B with cinematic production, dance-floor urgency, and a point of view that made every album feel like a statement.',gradient:'linear-gradient(135deg,#0d1a2a,#1a3a5a)',tags:['90s r&b','dance','icons']},
  'mary-j-blige':{name:'Mary J. Blige',tagline:'The Queen of Hip Hop Soul — raw, real, and unmatched.',bio:'Mary J. Blige invented the template: honest pain, hip hop drums, and vocal power that made every record feel personal. No artist in R&B has been more consistently herself.',gradient:'linear-gradient(135deg,#28101a,#6a283a)',tags:['hip hop soul','90s r&b','icons']},
  'beyonce':{name:'Beyoncé',tagline:'The most complete artist in modern R&B.',bio:'From Destiny\'s Child girl-group energy to solo dominance across every era, Beyoncé has redefined what an R&B catalog can be — danceable, conceptual, political, and always impeccably produced.',gradient:'linear-gradient(135deg,#1a1600,#3a3200)',tags:['icons','2000s r&b','women of r&b']},
  'alicia-keys':{name:'Alicia Keys',tagline:'Piano-driven neo soul with a classical soul at its core.',bio:'Alicia Keys brought live instrumentation and songwriting depth to early-2000s R&B, carving a lane that felt closer to classic soul than radio pop without losing an ounce of commercial power.',gradient:'linear-gradient(135deg,#1a0a00,#3a2200)',tags:['neo soul','2000s r&b','piano']},
  'the-weeknd':{name:'The Weeknd',tagline:'Dark R&B, cinematic production, and neon-noir atmosphere.',bio:'The Weeknd redrew the boundaries of what R&B sounds like in the 2010s: late-night production, morally ambiguous narratives, and a falsetto built for empty hotel corridors at 3am.',gradient:'linear-gradient(135deg,#100018,#240040)',tags:['2010s r&b','dark r&b','alt r&b']},
  'frank-ocean':{name:'Frank Ocean',tagline:'The most introspective voice in a generation of R&B.',bio:'Frank Ocean writes about vulnerability, identity, and memory with the kind of precision that turns personal records into universal ones. Blonde and Channel Orange remain the most studied R&B albums of the 2010s.',gradient:'linear-gradient(135deg,#001a18,#003028)',tags:['alt r&b','introspective','2010s']}
};

var player = null;
