// ============================================
// Global State Management
// ============================================
let allOfferings = [];
let filteredOfferings = [];
let currentIndex = 0;
let displayedCount = 0;
const ITEMS_PER_LOAD = 50;
const CURRENT_YEAR = 2025; // Update this for different years

// ============================================
// Initialize Application
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadOfferings();
    initializeOfferingsPage();
});

// ============================================
// Load JSON Data
// ============================================
async function loadOfferings() {
    try {
        const response = await fetch(`data/${CURRENT_YEAR}/offerings.json`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        allOfferings = await response.json();
        filteredOfferings = [...allOfferings];
        console.log(`Loaded ${allOfferings.length} offerings for ${CURRENT_YEAR}`);
    } catch (error) {
        console.error('Error loading offerings:', error);
        showError('Failed to load offerings. Please refresh the page.');
    }
}

// ============================================
// Initialize Offerings Page
// ============================================
function initializeOfferingsPage() {
    if (!document.getElementById('offerings-grid')) return;

    // Check if data is loaded
    if (allOfferings.length === 0) {
        console.error('No offerings data loaded');
        showError('No offerings data available. Please refresh the page.');
        return;
    }

    // Populate filter dropdowns
    populateFilters();

    // Initial render
    displayedCount = 0;
    renderOfferings(true);
    updateResultsCount();

    // Event listeners
    const searchInput = document.getElementById('search-input');
    const clearSearch = document.getElementById('clear-search');
    const countryFilter = document.getElementById('country-filter');
    const cityFilter = document.getElementById('city-filter');

    // Search with debounce
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            applyFilters();
            if (e.target.value) {
                clearSearch.style.display = 'flex';
            } else {
                clearSearch.style.display = 'none';
            }
        }, 300);
    });

    // Clear search
    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        clearSearch.style.display = 'none';
        applyFilters();
    });

    // Filter dropdowns
    countryFilter.addEventListener('change', applyFilters);
    cityFilter.addEventListener('change', applyFilters);

    // Infinite scroll
    window.addEventListener('scroll', handleScroll);

    // Modal controls
    setupModal();
}

// ============================================
// Populate Filter Dropdowns
// ============================================
function populateFilters() {
    const countries = new Set();
    const cities = new Set();

    allOfferings.forEach(offering => {
        if (offering.country) {
            countries.add(offering.country.trim());
        }
        if (offering['Name of City you are from']) {
            cities.add(offering['Name of City you are from'].trim());
        }
    });

    // Sort and populate country filter
    const countryFilter = document.getElementById('country-filter');
    const sortedCountries = Array.from(countries).sort();
    sortedCountries.forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        countryFilter.appendChild(option);
    });

    // Sort and populate city filter
    const cityFilter = document.getElementById('city-filter');
    const sortedCities = Array.from(cities).sort();
    sortedCities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        cityFilter.appendChild(option);
    });
}

// ============================================
// Apply Filters
// ============================================
function applyFilters() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const selectedCountry = document.getElementById('country-filter').value;
    const selectedCity = document.getElementById('city-filter').value;

    filteredOfferings = allOfferings.filter(offering => {
        // Search filter
        const matchesSearch = !searchTerm || 
            (offering['Your Name'] && offering['Your Name'].toLowerCase().includes(searchTerm)) ||
            (offering['Name of City you are from'] && offering['Name of City you are from'].toLowerCase().includes(searchTerm)) ||
            (offering.country && offering.country.toLowerCase().includes(searchTerm)) ||
            (offering['Your Offering'] && offering['Your Offering'].toLowerCase().includes(searchTerm));

        // Country filter
        const matchesCountry = !selectedCountry || offering.country === selectedCountry;

        // City filter
        const matchesCity = !selectedCity || offering['Name of City you are from'] === selectedCity;

        return matchesSearch && matchesCountry && matchesCity;
    });

    // Reset and re-render
    displayedCount = 0;
    document.getElementById('offerings-grid').innerHTML = '';
    renderOfferings(true);
    updateResultsCount();
}

// ============================================
// Render Offerings
// ============================================
function renderOfferings(reset = false) {
    const grid = document.getElementById('offerings-grid');
    const noResults = document.getElementById('no-results');
    const loadingIndicator = document.getElementById('loading-indicator');

    if (!grid) {
        console.error('Offerings grid not found');
        return;
    }

    if (reset) {
        grid.innerHTML = '';
        displayedCount = 0;
    }

    // Show/hide no results message
    if (filteredOfferings.length === 0) {
        if (noResults) noResults.style.display = 'block';
        if (loadingIndicator) loadingIndicator.classList.remove('active');
        return;
    } else {
        if (noResults) noResults.style.display = 'none';
    }

    // Calculate how many to display
    const endIndex = Math.min(displayedCount + ITEMS_PER_LOAD, filteredOfferings.length);

    // Use document fragment for better performance
    const fragment = document.createDocumentFragment();

    // Render cards
    for (let i = displayedCount; i < endIndex; i++) {
        const offering = filteredOfferings[i];
        const card = createOfferingCard(offering, i);
        fragment.appendChild(card);
    }

    grid.appendChild(fragment);
    displayedCount = endIndex;

    // Hide loading if all loaded
    if (displayedCount >= filteredOfferings.length && loadingIndicator) {
        loadingIndicator.classList.remove('active');
    }
}

// ============================================
// Create Offering Card
// ============================================
function createOfferingCard(offering, index) {
    const card = document.createElement('div');
    card.className = 'offering-card';
    card.setAttribute('data-index', index);

    const name = offering['Your Name'] || 'Anonymous';
    const city = offering['Name of City you are from'] || '';
    const country = offering.country || '';
    const text = offering['Your Offering'] || '';

    // Create location string
    let location = '';
    if (city && country) {
        location = `${city}, ${country}`;
    } else if (city) {
        location = city;
    } else if (country) {
        location = country;
    }

    // Create excerpt (first 150 characters)
    const excerpt = text.length > 150 ? text.substring(0, 150) + '...' : text;

    card.innerHTML = `
        <div class="card-header">
            <h3 class="card-name">${escapeHtml(name)}</h3>
            ${location ? `
                <div class="card-location">
                    <svg class="location-icon" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
                    </svg>
                    <span>${escapeHtml(location)}</span>
                </div>
            ` : ''}
        </div>
        <div class="card-excerpt">${escapeHtml(excerpt)}</div>
        <div class="card-footer">
            <span class="read-more">
                Read Full Offering
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </span>
        </div>
    `;

    // Add click handler
    card.addEventListener('click', () => openModal(index));

    return card;
}

// ============================================
// Modal Functions
// ============================================
function setupModal() {
    const modal = document.getElementById('offering-modal');
    const closeBtn = document.getElementById('modal-close');
    const overlay = modal.querySelector('.modal-overlay');
    const prevBtn = document.getElementById('modal-prev');
    const nextBtn = document.getElementById('modal-next');
    const modalContent = modal.querySelector('.modal-content');

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    prevBtn.addEventListener('click', () => navigateModal(-1));
    nextBtn.addEventListener('click', () => navigateModal(1));

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!modal.classList.contains('active')) return;

        if (e.key === 'Escape') closeModal();
        if (e.key === 'ArrowLeft') navigateModal(-1);
        if (e.key === 'ArrowRight') navigateModal(1);
    });

    // Touch gesture support for mobile
    let touchStartX = 0;
    let touchEndX = 0;
    const minSwipeDistance = 50;

    modalContent.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    modalContent.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const swipeDistance = touchEndX - touchStartX;
        
        if (Math.abs(swipeDistance) > minSwipeDistance) {
            if (swipeDistance > 0) {
                // Swipe right - previous
                navigateModal(-1);
            } else {
                // Swipe left - next
                navigateModal(1);
            }
        }
    }
}

function openModal(index) {
    currentIndex = index;
    updateModalContent();
    
    const modal = document.getElementById('offering-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('offering-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function navigateModal(direction) {
    currentIndex += direction;
    
    // Loop around
    if (currentIndex < 0) currentIndex = filteredOfferings.length - 1;
    if (currentIndex >= filteredOfferings.length) currentIndex = 0;
    
    updateModalContent();
}

function updateModalContent() {
    const offering = filteredOfferings[currentIndex];
    
    const name = offering['Your Name'] || 'Anonymous';
    const city = offering['Name of City you are from'] || '';
    const country = offering.country || '';
    const text = offering['Your Offering'] || 'No offering text available.';

    // Create location string
    let location = '';
    if (city && country) {
        location = `${city}, ${country}`;
    } else if (city) {
        location = city;
    } else if (country) {
        location = country;
    }

    document.getElementById('modal-name').textContent = name;
    document.getElementById('modal-location').innerHTML = location ? `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
        </svg>
        <span>${escapeHtml(location)}</span>
    ` : '';
    
    document.getElementById('modal-text').textContent = text;

    // Update navigation buttons
    const prevBtn = document.getElementById('modal-prev');
    const nextBtn = document.getElementById('modal-next');
    
    prevBtn.disabled = false;
    nextBtn.disabled = false;

    // Scroll to top of modal content
    document.querySelector('.modal-body').scrollTop = 0;
}

// ============================================
// Infinite Scroll Handler
// ============================================
function handleScroll() {
    if (displayedCount >= filteredOfferings.length) return;

    const scrollPosition = window.innerHeight + window.scrollY;
    const threshold = document.documentElement.scrollHeight - 500;

    if (scrollPosition >= threshold) {
        renderOfferings(false);
    }
}

// ============================================
// Update Results Count
// ============================================
function updateResultsCount() {
    const resultsElement = document.getElementById('results-count');
    if (!resultsElement) return;

    const total = filteredOfferings.length;
    const displayed = Math.min(displayedCount, total);

    if (total === 0) {
        resultsElement.textContent = 'No offerings found';
    } else if (total === allOfferings.length) {
        resultsElement.textContent = `Showing ${displayed} of ${total} offerings`;
    } else {
        resultsElement.textContent = `Showing ${displayed} of ${total} filtered offerings (${allOfferings.length} total)`;
    }
}

// ============================================
// Utility Functions
// ============================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    const grid = document.getElementById('offerings-grid');
    if (grid) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-medium);">
                <h3>Error</h3>
                <p>${message}</p>
            </div>
        `;
    }
}

// ============================================
// Export for use in other scripts
// ============================================
window.offeringsApp = {
    allOfferings,
    filteredOfferings,
    openModal,
    closeModal
};
