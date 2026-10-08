// Contenuti e traduzioni — portati dal prototipo Lady Bedford App.dc.html
export const TX = {
  it: {
    verandaCaption: 'La veranda sul giardino', inviteKicker: 'Bedford Square · 1874', inviteLine1: 'La famiglia Bedford ha il piacere di invitarvi per il tè, nel salotto di', inviteLine2: 'ogni pomeriggio, dalle undici alle sette.', inviteAddress: 'Via dei Glicini 18 · Tel. 02 1892 1892', inviteRsvp: 'Si prega di pulirsi le scarpe prima di entrare.', inviteCta: 'Varcate la soglia',
    homeSub: 'Il tè è in infusione e i pasticcini sono appena usciti dal forno.', butlerNote: 'Oggi la signora consiglia il Darjeeling First Flush, con uno scone ancora tiepido.', butlerSign: 'Mr. Hawkins, maggiordomo',
    homeOrder: 'Da asporto', homeOrderSub: 'Pronto in 20 minuti', homeTea: 'Afternoon tea', homeTeaSub: 'Riservate il salotto', homeToday: 'Oggi in dispensa', seeMenu: 'Vedi il menu',
    closedNow: 'Chiuso ora', soldOut: 'Esaurito', yourOrder: 'Il vostro ordine', orderError: 'Non siamo riusciti a inviare l\u2019ordine. Riprovate tra un momento.', orderSoldOut: 'Qualcosa è appena finito: controllate il cestino e riprovate.', statusCancelled: 'L\u2019ordine è stato annullato. Rivolgetevi al maggiordomo.', statusLabel: { new: 'Ricevuto', preparing: 'In preparazione', ready: 'Pronto al ritiro' }, homeStoryKicker: 'La nostra storia', homeStoryTitle: 'Come Lady Margaret aprì il salotto', readMore: 'Leggi', hours: 'Mar–Dom · 11:00–19:00', openNow: 'Aperto ora',
    vegan: 'Vegano', vegetarian: 'Vegetariano', add: 'Aggiungi',
    storyLead: 'Una casa, una famiglia, un salotto sempre aperto.', storyClose: 'Non entrate in un locale. Entrate in casa nostra.', storyGallery: 'Visitate le stanze',
    galleryIntro: 'Le stanze di casa Bedford, come le ha lasciate la famiglia.',
    servicesIntro: 'La padrona di casa è lieta di ricevervi in molti modi.',
    cardKicker: 'Carta da visita', memberSince: 'Ospite di casa dal 2025', pastOrders: 'I vostri cestini', language: 'Lingua', leave: 'Congedarsi e tornare all\u2019invito',
    cartEmpty: 'Il vostro cestino è ancora vuoto.', cartIntro: 'Ecco cosa la cuoca sta preparando per voi.', packaging: 'Scatola di latta Bedford', free: 'Omaggio', total: 'Totale', toCheckout: 'Procedi al ritiro',
    pickupTime: 'Orario di ritiro', pickupWhere: 'Ritiro all\u2019ingresso di servizio, sul retro.', nameLabel: 'A nome di', namePh: 'Il vostro nome', nameError: 'Il maggiordomo deve sapere a chi consegnare il cestino.', payment: 'Pagamento', placeOrder: 'Conferma l\u2019ordine',
    doneTitle: 'Ordine ricevuto', doneStamp: 'Un timbro è stato aggiunto alla vostra carta da visita.', backHome: 'Torna in salotto',
    tabHome: 'Casa', tabMenu: 'Menu', tabStory: 'Storia', tabGallery: 'Stanze', tabServices: 'Servizi',
    requestKicker: 'Richiesta', day: 'Giorno', guests: 'Ospiti', sendRequest: 'Invia la richiesta', sentKicker: 'Richiesta ricevuta', sentBody: 'Mr. Hawkins vi risponderà entro oggi per confermare.', close: 'Chiudi',
    viewCart: 'Cestino', added: 'aggiunto al cestino',
    headers: { home:['Buon pomeriggio','Lady Bedford’s'], menu:['La dispensa','Menu'], story:['Dal 1874','La storia'], gallery:['Casa Bedford','Le stanze'], services:['Al vostro servizio','Servizi'], profile:['Il vostro profilo','Carta da visita'], cart:['Da asporto','Il cestino'], checkout:['Da asporto','Ritiro'], done:['',''] },
    greet: (n: string) => `Benvenuta, ${n}.`, stamps: (n: number) => n >= 10 ? 'Il prossimo tè lo offre la padrona di casa.' : `Ancora ${10 - n} tè, e il prossimo lo offre la padrona di casa.`,
    done: (n: string, s: string) => `Mr. Hawkins avrà il cestino di ${n} pronto alle ${s}, all\u2019ingresso di servizio.`, orderNo: 'Ordine n.',
    payStore: 'Al ritiro', payStoreSub: 'Carta o contanti', payCard: 'Carta salvata', payCardSub: '•••• 1892',
    dows: ['Oggi','Dom','Lun','Mar'],
  },
  en: {
    verandaCaption: 'The veranda onto the garden', inviteKicker: 'Bedford Square · 1874', inviteLine1: 'The Bedford family requests the pleasure of your company for tea, in the drawing room of', inviteLine2: 'every afternoon, from eleven until seven.', inviteAddress: '18 Via dei Glicini · Tel. 02 1892 1892', inviteRsvp: 'Kindly wipe your shoes before entering.', inviteCta: 'Step inside',
    homeSub: 'The tea is steeping and the pastries have just left the oven.', butlerNote: 'Today her Ladyship recommends the Darjeeling First Flush, with a scone still warm.', butlerSign: 'Mr. Hawkins, butler',
    homeOrder: 'Takeaway', homeOrderSub: 'Ready in 20 minutes', homeTea: 'Afternoon tea', homeTeaSub: 'Reserve the drawing room', homeToday: 'In the pantry today', seeMenu: 'See the menu',
    closedNow: 'Closed now', soldOut: 'Sold out', yourOrder: 'Your order', orderError: 'We could not send your order. Please try again in a moment.', orderSoldOut: 'Something has just run out: check your hamper and try again.', statusCancelled: 'The order was cancelled. Please speak to the butler.', statusLabel: { new: 'Received', preparing: 'Being prepared', ready: 'Ready for pickup' }, homeStoryKicker: 'Our story', homeStoryTitle: 'How Lady Margaret opened her drawing room', readMore: 'Read', hours: 'Tue–Sun · 11:00–19:00', openNow: 'Open now',
    vegan: 'Vegan', vegetarian: 'Vegetarian', add: 'Add',
    storyLead: 'A house, a family, a drawing room always open.', storyClose: 'You are not entering a café. You are entering our home.', storyGallery: 'Visit the rooms',
    galleryIntro: 'The rooms of the Bedford house, just as the family left them.',
    servicesIntro: 'The lady of the house is delighted to receive you in many ways.',
    cardKicker: 'Calling card', memberSince: 'Guest of the house since 2025', pastOrders: 'Your hampers', language: 'Language', leave: 'Take your leave, back to the invitation',
    cartEmpty: 'Your hamper is still empty.', cartIntro: 'Here is what Cook is preparing for you.', packaging: 'Bedford tin box', free: 'Complimentary', total: 'Total', toCheckout: 'Proceed to pickup',
    pickupTime: 'Pickup time', pickupWhere: 'Collect at the tradesmen\u2019s entrance, at the back.', nameLabel: 'In the name of', namePh: 'Your name', nameError: 'The butler must know whom to hand the hamper to.', payment: 'Payment', placeOrder: 'Confirm order',
    doneTitle: 'Order received', doneStamp: 'A stamp has been added to your calling card.', backHome: 'Back to the drawing room',
    tabHome: 'Home', tabMenu: 'Menu', tabStory: 'Story', tabGallery: 'Rooms', tabServices: 'Services',
    requestKicker: 'Request', day: 'Day', guests: 'Guests', sendRequest: 'Send request', sentKicker: 'Request received', sentBody: 'Mr. Hawkins will reply today to confirm.', close: 'Close',
    viewCart: 'Hamper', added: 'added to your hamper',
    headers: { home:['Good afternoon','Lady Bedford’s'], menu:['The pantry','Menu'], story:['Since 1874','Our story'], gallery:['The Bedford house','The rooms'], services:['At your service','Services'], profile:['Your profile','Calling card'], cart:['Takeaway','Your hamper'], checkout:['Takeaway','Pickup'], done:['',''] },
    greet: (n: string) => `Welcome, ${n}.`, stamps: (n: number) => n >= 10 ? 'Your next tea is on the lady of the house.' : `${10 - n} more teas, and the next is on the lady of the house.`,
    done: (n: string, s: string) => `Mr. Hawkins will have ${n}\u2019s hamper ready at ${s}, at the tradesmen\u2019s entrance.`, orderNo: 'Order no.',
    payStore: 'At pickup', payStoreSub: 'Card or cash', payCard: 'Saved card', payCardSub: '•••• 1892',
    dows: ['Today','Sun','Mon','Tue'],
  }
};

export const CATS = [
  { id:'tea', it:'Tè', en:'Tea', introIt:'Foglie scelte da Lord Edward nei suoi viaggi, servite in teiera o sfuse da portare a casa.', introEn:'Leaves chosen by Lord Edward on his travels, brewed in the pot or loose to take home.' },
  { id:'pastry', it:'Pasticceria', en:'Pastries', introIt:'Le ricette della cuoca, Mrs. Pell, trascritte a mano nel suo quaderno.', introEn:'Recipes of Cook, Mrs. Pell, handwritten in her notebook.' },
  { id:'savoury', it:'Salato', en:'Savoury', introIt:'Per chi arriva a metà pomeriggio con un certo appetito.', introEn:'For those who arrive mid-afternoon with a certain appetite.' },
  { id:'mocktail', it:'Cocktail analcolici', en:'Mocktails', introIt:'Il bar di Lord Edward, senza una goccia d\u2019alcol: erbe del giardino, agrumi e bollicine.', introEn:'Lord Edward\u2019s bar, without a drop of alcohol: garden herbs, citrus and bubbles.' },
  { id:'hamper', it:'Cestini', en:'Hampers', introIt:'Il tè del pomeriggio, da portare al parco o a casa propria.', introEn:'Afternoon tea to take to the park, or to your own home.' },
];

export const MENU = [
  { id:'blend', cat:'tea', p:6.5, vg:1, it:['Lady Bedford Blend','Miscela della casa: Assam, Ceylon e un velo di bergamotto.'], en:['Lady Bedford Blend','House blend: Assam, Ceylon and a whisper of bergamot.'] },
  { id:'earl', cat:'tea', p:6, vg:1, it:['Earl Grey alla crema','Con latte d\u2019avena montato e fiordaliso.'], en:['Cream Earl Grey','With steamed oat milk and cornflower.'] },
  { id:'darj', cat:'tea', p:7, vg:1, it:['Darjeeling First Flush','Raccolto di primavera, note di moscato.'], en:['Darjeeling First Flush','Spring harvest, muscatel notes.'] },
  { id:'rooi', cat:'tea', p:5.5, vg:1, it:['Rooibos alla vaniglia','Senza teina, per la sera.'], en:['Vanilla Rooibos','Caffeine-free, for the evening.'] },
  { id:'scone', cat:'pastry', p:4.5, vg:1, it:['Scone della cuoca','Con crema di anacardi e confettura di fragole.'], en:['Cook\u2019s scone','With cashew cream and strawberry jam.'] },
  { id:'sponge', cat:'pastry', p:5.5, vg:0, it:['Victoria sponge','Pan di Spagna, lamponi e crema al burro.'], en:['Victoria sponge','Sponge, raspberries and buttercream.'] },
  { id:'lemon', cat:'pastry', p:5, vg:1, it:['Lemon drizzle','Torta al limone con glassa croccante.'], en:['Lemon drizzle','Lemon loaf with a crackling glaze.'] },
  { id:'short', cat:'pastry', p:3.5, vg:0, it:['Shortbread','Biscotti di frolla al burro, tre pezzi.'], en:['Shortbread','Butter shortbread, three pieces.'] },
  { id:'cucu', cat:'savoury', p:6, vg:1, it:['Tramezzini al cetriolo','Cetriolo, aneto e formaggio vegetale.'], en:['Cucumber sandwiches','Cucumber, dill and plant-based cheese.'] },
  { id:'rare', cat:'savoury', p:8, vg:0, it:['Welsh rarebit','Pane tostato con cheddar fuso e senape.'], en:['Welsh rarebit','Toast with melted cheddar and mustard.'] },
  { id:'pie', cat:'savoury', p:9, vg:1, it:['Pasticcio di funghi e porri','Pasta brisée vegetale, timo del giardino.'], en:['Mushroom & leek pie','Plant-based shortcrust, garden thyme.'] },
  { id:'garden', cat:'mocktail', p:7.5, vg:1, it:['Bedford Garden','Cetriolo, menta e lime con acqua tonica.'], en:['Bedford Garden','Cucumber, mint and lime with tonic water.'] },
  { id:'hibiscus', cat:'mocktail', p:7.5, vg:1, it:['Hibiscus Sour','Infuso freddo di ibisco, limone e sciroppo di agave.'], en:['Hibiscus Sour','Cold hibiscus infusion, lemon and agave syrup.'] },
  { id:'rosa', cat:'mocktail', p:7.5, vg:1, it:['Rosa e Lampone','Lamponi pestati, acqua di rose e soda.'], en:['Rose & Raspberry','Muddled raspberries, rosewater and soda.'] },
  { id:'earlfizz', cat:'mocktail', p:7, vg:1, it:['Earl Grey Fizz','Earl Grey freddo, limone, zucchero di canna e bollicine.'], en:['Earl Grey Fizz','Iced Earl Grey, lemon, cane sugar and bubbles.'] },
  { id:'picnic', cat:'hamper', p:32, vg:1, it:['Cestino per due','Tè sfuso, 2 scone, tramezzini, 2 dolci a scelta della cuoca.'], en:['Hamper for two','Loose tea, 2 scones, sandwiches, 2 cakes chosen by Cook.'] },
  { id:'gift', cat:'hamper', p:24, vg:1, it:['Latta regalo','Miscela Lady Bedford’s 100 g e shortbread vegano.'], en:['Gift tin','Lady Bedford Blend 100 g and vegan shortbread.'] },
];

export const CHAPTERS = {
  it: [
    { num:'I', kicker:'Autunno 1874', title:'Un salotto aperto al mondo', body:'Rimasta sola nella grande casa di Bedford Square, Lady Margaret decise che le porte del suo salotto non sarebbero più rimaste chiuse. Ogni pomeriggio, alle quattro, chiunque bussasse avrebbe trovato una tazza di tè e una sedia accanto al camino.', img:'Ritratto di Lady Margaret' },
    { num:'II', kicker:'La famiglia', title:'Lord Edward e la tavola senza carne', body:'Botanico e viaggiatore, Lord Edward era tra i soci della Vegetarian Society. In casa Bedford non si serviva carne: la cuoca imparò a far meraviglie con ortaggi, frutta e burro. Oggi andiamo oltre, e gran parte della dispensa è anche vegana.', img:'La serra di Lord Edward' },
    { num:'III', kicker:'La casa', title:'Tre stanze, tre umori', body:'Nel salotto verde una parete intera si apre, dipinta, su un giardino inglese lasciato inselvatichire: una veranda che nessuno chiude più. Il salotto per le conversazioni, la biblioteca per chi preferisce il silenzio, la serra per le giornate di sole. Ogni mobile, ogni tazza di porcellana e ogni ritratto racconta un pezzo della famiglia.', img:'La biblioteca' },
    { num:'IV', kicker:'Perché una storia', title:'Non un locale, ma una casa', body:'Abbiamo dato vita alla famiglia Bedford perché crediamo che il tè si beva meglio da ospiti. Il maggiordomo, le lettere d\u2019invito, la carta da visita: sono inviti a lasciare fuori la fretta e a sedersi, per un’ora, in un altro secolo.', img:'' },
  ],
  en: [
    { num:'I', kicker:'Autumn 1874', title:'A drawing room open to the world', body:'Left alone in the great house on Bedford Square, Lady Margaret decided her drawing room doors would no longer stay shut. Every afternoon at four, whoever knocked would find a cup of tea and a chair by the fire.', img:'Portrait of Lady Margaret' },
    { num:'II', kicker:'The family', title:'Lord Edward and the meatless table', body:'A botanist and traveller, Lord Edward was a member of the Vegetarian Society. No meat was served in the Bedford house: Cook learned to work wonders with vegetables, fruit and butter. Today we go further, and most of the pantry is vegan too.', img:'Lord Edward\u2019s conservatory' },
    { num:'III', kicker:'The house', title:'Three rooms, three moods', body:'In the green drawing room an entire wall opens, painted, onto an English garden gone wild: a veranda no one closes any more. The drawing room for conversation, the library for those who prefer silence, the conservatory for sunny days. Every piece of furniture, every porcelain cup and every portrait tells part of the family story.', img:'The library' },
    { num:'IV', kicker:'Why a story', title:'Not a café, but a home', body:'We brought the Bedford family to life because we believe tea tastes better as a guest. The butler, the letters of invitation, the calling card: each asks you to leave the rush outside and sit, for an hour, in another century.', img:'' },
  ]
};

export const GALLERY = [
  { id:'0', span:'span 2', h:'260px', src:'img/gal-0.webp', it:'La carta da parati: il giardino in rovina', en:'The wallpaper: the garden in ruins' },
  { id:'1', span:'span 2', h:'300px', src:'img/gal-1.webp', it:'Il salotto verde', en:'The green drawing room' },
  { id:'2', span:'span 1', h:'220px', src:'img/gal-2.webp', it:'Lo specchio dorato', en:'The gilded mirror' },
  { id:'3', span:'span 1', h:'220px', src:'img/gal-3.webp', it:'Il camino', en:'The fireplace' },
  { id:'4', span:'span 2', h:'280px', src:'img/photo-4662.webp', it:'La veranda dipinta', en:'The painted veranda' },
  { id:'5', span:'span 2', h:'180px', src:'img/photo-4666.webp', it:'Le cementine', en:'The encaustic tiles' },
  { id:'6', span:'span 2', h:'240px', src:'img/photo-4667.webp', it:'Il lampadario della sala', en:'The chandelier in the hall' },
  { id:'7', span:'span 1', h:'230px', src:'img/photo-4663.webp', it:'I tavolini in veranda', en:'Tables on the veranda' },
  { id:'8', span:'span 1', h:'230px', src:'img/photo-4664.webp', it:'Lo specchio, oggi', en:'The mirror, today' },
];

export const SERVICES = {
  it: [
    { id:'tea', kicker:'Ogni pomeriggio', title:'Afternoon tea in salotto', body:'Alzatina a tre piani con tramezzini, scone e dolci della cuoca, e tè a volontà dalla dispensa di Lord Edward.', price:'€ 28 a persona', cta:'Riserva', img:'Foto: alzatina servita' },
    { id:'party', kicker:'Su richiesta', title:'Ricevimenti privati', body:'Compleanni, fidanzamenti, baby shower: la casa intera, fino a 24 ospiti, con servizio del maggiordomo.', price:'Da € 45 a persona', cta:'Richiedi', img:'Foto: sala allestita' },
    { id:'class', kicker:'Il sabato mattina', title:'Lezioni di tè', body:'Un’ora con la padrona di casa tra foglie, temperature e porcellane. Degustazione di cinque tè inclusa.', price:'€ 35 a persona', cta:'Riserva', img:'' },
    { id:'gift', kicker:'Da regalare', title:'Buono ospite', body:'Un invito su carta di cotone, sigillato a ceralacca, per un afternoon tea a casa Bedford.', price:'Da € 30', cta:'Richiedi', img:'' },
  ],
  en: [
    { id:'tea', kicker:'Every afternoon', title:'Afternoon tea in the drawing room', body:'A three-tier stand of sandwiches, scones and Cook\u2019s cakes, with endless tea from Lord Edward\u2019s pantry.', price:'€ 28 per person', cta:'Reserve', img:'Photo: served tea stand' },
    { id:'party', kicker:'On request', title:'Private receptions', body:'Birthdays, engagements, baby showers: the whole house, up to 24 guests, with the butler in attendance.', price:'From € 45 per person', cta:'Enquire', img:'Photo: room set for a party' },
    { id:'class', kicker:'Saturday mornings', title:'Tea lessons', body:'An hour with the lady of the house among leaves, temperatures and porcelain. Tasting of five teas included.', price:'€ 35 per person', cta:'Reserve', img:'' },
    { id:'gift', kicker:'To give', title:'Guest voucher', body:'An invitation on cotton paper, sealed with wax, for an afternoon tea at the Bedford house.', price:'From € 30', cta:'Enquire', img:'' },
  ]
};

export const SLOTS = ['16:00','16:30','17:00','17:30','18:00','18:30'];
export const TABS = ['home','menu','story','gallery','services'] as const;
export const eur = (n: number, lang: string) => '€ ' + n.toFixed(2).replace('.', lang === 'it' ? ',' : '.');

export type Lang = keyof typeof TX
export type Dict = typeof TX['it']
export type Screen = 'invite'|'home'|'menu'|'story'|'gallery'|'services'|'profile'|'cart'|'checkout'|'done'

// Fotografie (public/img). Chiave = id dello slot nel prototipo.
export const IMG = {
  hero: 'img/photo-4662.webp',
  portrait: 'img/story-I.webp',
  story: { I: 'img/story-I.webp', II: 'img/story-II.webp', III: 'img/story-III.webp' } as Record<string, string>,
  svc: { tea: 'img/story-II.webp', party: 'img/photo-4667.webp' } as Record<string, string>,
}
