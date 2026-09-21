import { countries } from './countries.js'

// Compléments de villes pour les principaux pays cibles (CEMAC, Afrique, Diaspora)
const manualCityOverrides = {
  CM: [
    'Douala', 'Yaoundé', 'Garoua', 'Bamenda', 'Maroua', 'Bafoussam', 'Ngaoundéré', 'Bertoua', 
    'Edéa', 'Loum', 'Kumba', 'Nkongsamba', 'Mbouda', 'Dschang', 'Foumban', 'Ebolowa', 'Guider', 
    'Meiganga', 'Yagoua', 'Kousséri', 'Kribi', 'Limbe', 'Limbé', 'Buea', 'Bafia', 'Sangmélima', 
    'Bangangté', 'Tibati', 'Bafut', 'Bali', 'Wum', 'Fontem', 'Melong', 'Manjo', 'Penja', 'Mbanga', 
    'Obala', 'Mbalmayo', 'Mfou', 'Akonolinga', 'Nanga Eboko', 'Monatélé', 'Batouri', 'Abong Mbang', 
    'Yokadouma', 'Bétaré-Oya', 'Garoua-Boulaï', 'Moloundou', 'Belabo', 'Ngaoundal', 'Bankim', 
    'Banyo', 'Tignère', 'Poli', 'Tcholliré', 'Rey-Bouba', 'Figuil', 'Pitoa', 'Lagdo', 'Kaélé', 
    'Mora', 'Mokolo', 'Meri', 'Bogo', 'Maga', 'Makary', 'Waza', 'Fotokol', 'Goulfey', 'Moundou', 
    'Eseka', 'Dizangué', 'Mouanko', 'Yabassi', 'Tiko', 'Muyuka', 'Tombel', 'Mamfe', 'Mundemba', 
    'Kumbo', 'Ndu', 'Nkambe', 'Mbengwi', 'Batibo', 'Fundong', 'Bandjoun', 'Baham', 'Batié', 
    'Bamendjou', 'Bazou', 'Tonga', 'Foumbot', 'Malantouen', 'Koutaba', 'Kouoptamo', 'Zoétélé', 
    'Meyomessala', 'Djoum', 'Campo', 'Lolodorf', 'Ambam', 'Kyé-Ossi'
  ],
  TD: [
    "N'Djamena", 'Moundou', 'Sarh', 'Abéché', 'Kélo', 'Koumra', 'Pala', 'Am Timan', 'Bongor', 'Mongo',
    'Doba', 'Ati', 'Laï', 'Mao', 'Faya-Largeau', 'Bitkine', 'Oum Hadjer', 'Goz Beïda'
  ],
  CF: [
    'Bangui', 'Bimbo', 'Bégoua', 'Carnot', 'Berbérati', 'Bambari', 'Bria', 'Bouar', 'Bossangoa', 'Nola'
  ],
  CG: [
    'Brazzaville', 'Pointe-Noire', 'Dolisie', 'Nkayi', 'Kindamba', 'Impfondo', 'Ouésso', 'Madingou', 'Owando'
  ],
  GA: [
    'Libreville', 'Port-Gentil', 'Franceville', 'Oyem', 'Moanda', 'Mouila', 'Lambaréné', 'Tchibanga', 'Koulamoutou', 'Makokou'
  ],
  GQ: [
    'Malabo', 'Bata', 'Ebebiyín', 'Aconibe', 'Añisoc', 'Luba', 'Evinayong', 'Mongomo'
  ],
  CI: [
    'Abidjan', 'Bouaké', 'Daloa', 'Yamoussoukro', 'San-Pédro', 'Korhogo', 'Man', 'Divo', 'Gagnoa', 'Abengourou', 'Anyama', 'Soubré'
  ],
  SN: [
    'Dakar', 'Touba', 'Thiès', 'Kaolack', 'M\'bour', 'Saint-Louis', 'Rufisque', 'Ziguinchor', 'Diourbel', 'Tambacounda'
  ],
  BE: [
    'Bruxelles', 'Anvers', 'Gand', 'Charleroi', 'Liège', 'Bruges', 'Namur', 'Louvain', 'Mons', 'Alost'
  ],
  FR: [
    'Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Montpellier', 'Strasbourg', 'Bordeaux', 'Lille', 'Rennes', 'Toulon', 'Reims', 'Saint-Étienne', 'Le Havre'
  ],
  CA: [
    'Montréal', 'Toronto', 'Vancouver', 'Ottawa', 'Calgary', 'Edmonton', 'Québec', 'Winnipeg', 'Hamilton', 'Laval'
  ],
  US: [
    'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Austin', 'Washington', 'Atlanta', 'Miami', 'Boston'
  ]
}

let cachedCityLib = null

/**
 * Charge dynamiquement le catalogue complet des villes pour un pays donné
 * Utilise un dynamic import pour préserver la légèreté du bundle principal de l'application
 * @param {string} countryNameOrCode - Nom du pays (ex: 'Cameroun') ou code ISO2 (ex: 'CM')
 * @returns {Promise<string[]>} Liste triée des villes
 */
export async function getCitiesForCountry(countryNameOrCode) {
  if (!countryNameOrCode) return []

  const cleanInput = countryNameOrCode.trim()

  const foundCountry = countries.find(
    c => c.name.localeCompare(cleanInput, 'fr', { sensitivity: 'accent' }) === 0 ||
         c.code.toUpperCase() === cleanInput.toUpperCase() ||
         (c.english && c.english.localeCompare(cleanInput, 'en', { sensitivity: 'accent' }) === 0)
  )

  const code = foundCountry ? foundCountry.code.toUpperCase() : cleanInput.toUpperCase()

  let libCities = []
  try {
    if (!cachedCityLib) {
      const mod = await import('country-state-city')
      cachedCityLib = mod.City
    }
    const raw = cachedCityLib.getCitiesOfCountry(code)
    if (Array.isArray(raw)) {
      libCities = raw.map(c => c.name)
    }
  } catch {
    libCities = []
  }

  const manual = manualCityOverrides[code] || []

  const cityMap = new Map()
  for (const city of [...manual, ...libCities]) {
    if (!city || typeof city !== 'string') continue
    const trimmed = city.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (!cityMap.has(key)) {
      cityMap.set(key, trimmed)
    }
  }

  return Array.from(cityMap.values()).sort((a, b) =>
    a.localeCompare(b, 'fr', { sensitivity: 'base' })
  )
}

/**
 * Retourne immédiatement les villes clés prédéfinies (sans attendre l'import dynamique)
 */
export function getImmediateCitiesForCountry(countryNameOrCode) {
  if (!countryNameOrCode) return []
  const cleanInput = countryNameOrCode.trim()
  const foundCountry = countries.find(
    c => c.name.localeCompare(cleanInput, 'fr', { sensitivity: 'accent' }) === 0 ||
         c.code.toUpperCase() === cleanInput.toUpperCase()
  )
  const code = foundCountry ? foundCountry.code.toUpperCase() : cleanInput.toUpperCase()
  const manual = manualCityOverrides[code] || []
  return manual.slice().sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
}
