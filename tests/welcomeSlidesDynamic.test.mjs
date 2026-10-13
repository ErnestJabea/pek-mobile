import { test } from 'node:test'
import assert from 'node:assert/strict'

// Simulation de la fonction getWelcomeSlides avec injection de contents et isEn
function computeWelcomeSlides(contents, isEn) {
  const slideItems = Object.values(contents).filter(
    (item) => item && (item.section === 'welcome_slides' || (typeof item.key === 'string' && item.key.startsWith('welcome_slide_'))) && item.is_active !== false
  )

  if (slideItems.length > 0) {
    slideItems.sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
    return slideItems.map((item, index) => ({
      id: item.id || item.key,
      key: item.key,
      title: isEn ? (item.title_en || item.title_fr || '') : (item.title_fr || item.title_en || ''),
      description: isEn ? (item.body_en || item.body_fr || '') : (item.body_fr || item.body_en || ''),
      image_url: item.image_url || (item.image_path ? `/storage/${item.image_path}` : null),
      sort_order: item.sort_order || index + 1
    }))
  }

  return []
}

test('returns empty array when no welcome_slides configured', () => {
  const result = computeWelcomeSlides({}, false)
  assert.deepEqual(result, [])
})

test('correctly extracts and sorts welcome slides from backoffice contents in French', () => {
  const mockContents = {
    welcome_slide_2: {
      id: 3,
      section: 'welcome_slides',
      key: 'welcome_slide_2',
      title_fr: 'Sécurité & Régulation',
      title_en: 'Security & Regulation',
      body_fr: 'Renseignez vos informations de profil.',
      body_en: 'Complete your profile.',
      sort_order: 2,
      is_active: true
    },
    welcome_slide_1: {
      id: 2,
      section: 'welcome_slides',
      key: 'welcome_slide_1',
      title_fr: 'Votre épargne, simplifiée.',
      title_en: 'Your savings, simplified.',
      body_fr: 'Découvrez le PEK par Kori Asset Management.',
      body_en: 'Discover PEK by Kori Asset Management.',
      sort_order: 1,
      is_active: true
    }
  }

  const slides = computeWelcomeSlides(mockContents, false)
  assert.equal(slides.length, 2)
  assert.equal(slides[0].key, 'welcome_slide_1')
  assert.equal(slides[0].title, 'Votre épargne, simplifiée.')
  assert.equal(slides[0].description, 'Découvrez le PEK par Kori Asset Management.')

  assert.equal(slides[1].key, 'welcome_slide_2')
  assert.equal(slides[1].title, 'Sécurité & Régulation')
})

test('correctly serves English texts when language is English', () => {
  const mockContents = {
    welcome_slide_1: {
      id: 2,
      section: 'welcome_slides',
      key: 'welcome_slide_1',
      title_fr: 'Votre épargne, simplifiée.',
      title_en: 'Your savings, simplified.',
      body_fr: 'Découvrez le PEK.',
      body_en: 'Discover PEK.',
      sort_order: 1,
      is_active: true
    }
  }

  const slides = computeWelcomeSlides(mockContents, true)
  assert.equal(slides.length, 1)
  assert.equal(slides[0].title, 'Your savings, simplified.')
  assert.equal(slides[0].description, 'Discover PEK.')
})

test('ignores deactivated slides (is_active === false)', () => {
  const mockContents = {
    welcome_slide_1: {
      id: 2,
      section: 'welcome_slides',
      key: 'welcome_slide_1',
      title_fr: 'Slide active',
      title_en: 'Active slide',
      is_active: true
    },
    welcome_slide_disabled: {
      id: 3,
      section: 'welcome_slides',
      key: 'welcome_slide_disabled',
      title_fr: 'Slide désactivée',
      title_en: 'Disabled slide',
      is_active: false
    }
  }

  const slides = computeWelcomeSlides(mockContents, false)
  assert.equal(slides.length, 1)
  assert.equal(slides[0].key, 'welcome_slide_1')
})

test('modifications made in backoffice immediately propagate to slides', () => {
  const backofficeData = {
    welcome_slide_1: {
      section: 'welcome_slides',
      key: 'welcome_slide_1',
      title_fr: 'Titre Original FR',
      title_en: 'Original Title EN',
      body_fr: 'Texte Original FR',
      body_en: 'Original Text EN',
      sort_order: 1,
      is_active: true
    }
  }

  let slides = computeWelcomeSlides(backofficeData, false)
  assert.equal(slides[0].title, 'Titre Original FR')

  // Simulation d'une modification effectuée par l'admin dans Filament
  backofficeData.welcome_slide_1.title_fr = 'NOUVEAU TITRE PROMO BACKOFFICE'
  slides = computeWelcomeSlides(backofficeData, false)
  assert.equal(slides[0].title, 'NOUVEAU TITRE PROMO BACKOFFICE')
})
