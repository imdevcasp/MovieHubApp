$(document).ready(function () {
    const f7 = new Framework7({
        root: '#app',
        theme: 'ios',
        name: 'MovieHub',
        id: 'com.moviehub.app',
        darkMode: true
    });

    const tmdbApiKey = 'YOUR_TMDB_API_KEY';
    const tmdbBaseUrl = 'https://api.themoviedb.org/3';
    const tmdbImageBaseUrl = 'https://image.tmdb.org/t/p/w500';

    let currentMedia = null;
    let currentPlayback = { id: null, type: null, season: null, episode: null, currentEpisodeIndex: null };
    let particles = [];

    const sectionState = {
        'featured': { page: 1, totalPages: 1, query: '', type: 'movie' },
        'featured-tv': { page: 1, totalPages: 1, query: '', type: 'tv' },
        'trending': { page: 1, totalPages: 1, query: '', type: 'movie' },
        'trending-tv': { page: 1, totalPages: 1, query: '', type: 'tv' },
        'top-rated': { page: 1, totalPages: 1, query: '', type: 'movie' },
        'top-rated-tv': { page: 1, totalPages: 1, query: '', type: 'tv' },
        'search-movie': { page: 1, totalPages: 1, query: '', type: 'movie' },
        'search-tv': { page: 1, totalPages: 1, query: '', type: 'tv' }
    };

    function showLoading(show) {
        if (show) {
            if (!$('#loading-screen').length) {
                $('body').append(`
                    <div id="loading-screen" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:9999;display:flex;justify-content:center;align-items:center;flex-direction:column;color:#00f5ff;font-size:1.2rem;">
                        <i class="fas fa-spinner fa-spin" style="font-size:3rem;margin-bottom:15px;"></i>
                        <div>Loading MovieHub...</div>
                    </div>
                `);
            }
            $('#loading-screen').show();
        } else {
            $('#loading-screen').fadeOut(300, function(){ $(this).remove(); });
        }
    }

    function switchView(viewId) {
        $('.view').addClass('hidden');
        $(`#${viewId}`).removeClass('hidden');
    }

    function switchTab(tabId) {
        $('.tab').removeClass('tab-active');
        $(`#${tabId}`).addClass('tab-active');
        $('.tab-link').removeClass('active');
        $(`.tab-link[data-tab="${tabId}"]`).addClass('active');

        if (tabId === 'home-tab') loadHomeTab();
        else if (tabId === 'search-tab') loadSearchTab();
        else if (tabId === 'favorites-tab') loadFavoritesTab();
        else if (tabId === 'profile-tab') loadProfileTab();
    }

    function initParticles() {
        const canvas = document.createElement('canvas');
        canvas.id = 'particles-canvas';
        document.getElementById('app').appendChild(canvas);
        const ctx = canvas.getContext('2d');

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        for (let i = 0; i < 50; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                opacity: Math.random() * 0.5 + 0.3,
                scale: Math.random() + 0.5
            });
        }

        function animate() {
            resizeCanvas();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.opacity -= 0.008;
                if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
                if (p.opacity <= 0) {
                    p.x = Math.random() * canvas.width;
                    p.y = Math.random() * canvas.height;
                    p.opacity = Math.random() * 0.5 + 0.3;
                    p.scale = Math.random() + 0.5;
                }
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2.5 * p.scale, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0, 245, 255, ${p.opacity})`;
                ctx.fill();
            });
            requestAnimationFrame(animate);
        }
        animate();
    }

    async function fetchMedia(section, page, query = '') {
        showLoading(true);
        const isTv = section.includes('tv');
        let endpoint = query ? (isTv ? 'search/tv' : 'search/movie') : {
            'featured': isTv ? 'discover/tv' : 'discover/movie',
            'featured-tv': 'discover/tv',
            'trending': isTv ? 'trending/tv/day' : 'trending/movie/day',
            'trending-tv': 'trending/tv/day',
            'top-rated': isTv ? 'tv/top_rated' : 'movie/top_rated',
            'top-rated-tv': 'tv/top_rated',
            'search-movie': 'search/movie',
            'search-tv': 'search/tv'
        }[section] || 'discover/movie';

        const url = `${tmdbBaseUrl}/${endpoint}?api_key=${tmdbApiKey}${query ? `&query=${encodeURIComponent(query)}` : ''}&page=${page}&include_adult=false`;

        try {
            const response = await $.ajax({ url, method: 'GET', dataType: 'json', timeout: 10000 });
            if (!response.results) throw new Error('No results');
            sectionState[section].totalPages = response.total_pages || 1;

            const items = await Promise.all(response.results.map(async item => {
                const isTvItem = !!item.name || isTv;
                let imdbId = item.id.toString();
                try {
                    const ext = await $.ajax({ url: `${tmdbBaseUrl}/${isTvItem ? 'tv' : 'movie'}/${item.id}/external_ids?api_key=${tmdbApiKey}`, method: 'GET', dataType: 'json', timeout: 3000 });
                    if (ext.imdb_id) imdbId = ext.imdb_id;
                } catch (e) {}
                let seasons = [];
                if (isTvItem) {
                    try {
                        const details = await $.ajax({ url: `${tmdbBaseUrl}/tv/${item.id}?api_key=${tmdbApiKey}`, method: 'GET', dataType: 'json', timeout: 3000 });
                        seasons = details.seasons ? details.seasons.map(s => ({ season_number: s.season_number, episode_count: s.episode_count || 0 })) : [];
                    } catch (e) {}
                }
                return {
                    id: item.id,
                    title: isTvItem ? (item.name || 'Unknown') : (item.title || 'Unknown'),
                    poster: item.poster_path ? `${tmdbImageBaseUrl}${item.poster_path}` : null,
                    backdropPath: item.backdrop_path,
                    rating: item.vote_average || 0,
                    overview: item.overview || 'No description available.',
                    imdbId: imdbId,
                    type: isTvItem ? 'tv' : 'movie',
                    seasons: seasons,
                    year: (isTvItem ? item.first_air_date : item.release_date) ? parseInt((isTvItem ? item.first_air_date : item.release_date).substring(0,4)) : null
                };
            }));

            const validItems = items.filter(item => 
                item.id && 
                item.title && 
                item.title !== 'Unknown' &&
                item.poster && 
                item.poster !== 'https://casp.dev/imovies/imovies.png' &&
                item.rating > 0 &&
                item.overview.length > 20
            );

            renderMedia(section, validItems, isTv ? 'tv' : 'movie');
            updatePagination(section);
        } catch (error) {
            console.error(`Failed to load ${section}:`, error);
            $(`#${section}-content`).html(`<p class="error-message">Failed to load content. Please check connection.</p>`);
        } finally {
            showLoading(false);
        }
    }

    function renderMedia(section, items, type) {
        if (items.length === 0) {
            $(`#${section}-content`).html('<p class="empty-message">No results found.</p>');
            return;
        }
        const html = items.map(item => {
            const mediaData = JSON.stringify(item);
            return `
                <div class="media-card" data-media='${mediaData}' data-type="${type}">
                    <img src="${item.poster}" alt="${item.title}" loading="lazy">
                    <p>${item.title}</p>
                    <a style="background-color:#1F1B24 !important;border-radius:50px;margin:auto;" class="button button-fill liquid-glass">
                    <i class="fas fa-play-circle play-button-overlay"></i></a>
                </div>
            `;
        }).join('');
        $(`#${section}-content`).html(html);

        $(`#${section}-content .media-card`).off('click').on('click', function() {
            const mediaData = $(this).data('media');
            if (mediaData) {
                currentMedia = mediaData;
                showInfoCard();
            }
        });
    }

    function updatePagination(section) {
        const state = sectionState[section];
        $(`#${section}-prev`).prop('disabled', state.page === 1);
        $(`#${section}-next`).prop('disabled', state.page >= state.totalPages);
    }

    function showInfoCard() {
        if (!currentMedia) return;

        $('#info-card .info-card-banner').attr('src', ''); 
        const bannerSrc = currentMedia.backdropPath ? `${tmdbImageBaseUrl}${currentMedia.backdropPath}` : currentMedia.poster || '';
        $('#info-card .info-card-banner').attr('src', bannerSrc);

        $('#info-card .info-card-title').text(currentMedia.title || 'Title not available');
        $('#info-card .info-card-description').text(currentMedia.overview || 'No description available.');
        $('#info-card .info-card-rating').text(`Rating: ${currentMedia.rating > 0 ? currentMedia.rating : 'N/A'}/10`);

        if (currentMedia.type === 'tv' && currentMedia.seasons && currentMedia.seasons.length) {
            const realSeasons = currentMedia.seasons.filter(s => s.season_number >= 1);
            if (realSeasons.length > 0) {
                $('#season-selector').removeClass('hidden').html(
                    '<option value="">Select Season</option>' +
                    realSeasons.map(s => `<option value="${s.season_number}">Season ${s.season_number}</option>`).join('')
                );
                $('#episode-selector').removeClass('hidden');

                $('#season-selector').off('change').on('change', function() {
                    const season = $(this).val();
                    if (season) {
                        const selected = realSeasons.find(s => s.season_number == season);
                        if (selected) {
                            const eps = Array.from({ length: selected.episode_count }, (_, i) => i + 1);
                            $('#episode-selector').html('<option value="">Select Episode</option>' + eps.map(e => `<option value="${e}">Episode ${e}</option>`).join(''));
                        }
                    } else {
                        $('#episode-selector').html('<option value="">Select Episode</option>');
                    }
                });
            } else {
                $('#season-selector, #episode-selector').addClass('hidden');
            }
        } else {
            $('#season-selector, #episode-selector').addClass('hidden');
        }

        let favs = JSON.parse(localStorage.getItem('favoriteMedia') || '[]');
        const isFavorited = favs.some(m => m.id === currentMedia.id && m.type === currentMedia.type);

        const favBtn = $('#info-card .info-card-favorite');
        favBtn.html(isFavorited 
            ? '<i class="fas fa-heart"></i> Remove from Favorites'
            : '<i class="far fa-heart"></i> Add to Favorites'
        );

        favBtn.off('click').on('click', function() {
            if (isFavorited) {
                favs = favs.filter(m => !(m.id === currentMedia.id && m.type === currentMedia.type));
                localStorage.setItem('favoriteMedia', JSON.stringify(favs));
                loadFavoritesTab();
                favBtn.html('<i class="far fa-heart"></i> Add to Favorites');
            } else {
                favs.unshift(currentMedia);
                if (favs.length > 20) favs = favs.slice(0, 20);
                localStorage.setItem('favoriteMedia', JSON.stringify(favs));
                loadFavoritesTab();
                favBtn.html('<i class="fas fa-heart"></i> Remove from Favorites');
            }
        });

        $('#info-card').removeClass('hidden').addClass('active');

        $(document).off('click.infoCard').on('click.infoCard', function(e) {
            if (!$(e.target).closest('#info-card, .media-card, .close-btn').length) {
                $('#info-card').removeClass('active');
            }
        });
    }

    $('#info-card .close-btn').off('click').on('click', function() {
        $('#info-card').removeClass('active').addClass('hidden');
        currentMedia = null;
    });

    $('#info-card .info-card-play').off('click').on('click', function() {
        if (!currentMedia || !currentMedia.imdbId) return;
        let watchedMedia = JSON.parse(localStorage.getItem('watchedMedia') || '[]');
        const season = $('#season-selector').val();
        const episode = $('#episode-selector').val();
        const selectedSource = $('#source-selector').val() || 'player.autoembed.cc';

        const mediaToSave = { ...currentMedia };
        if (currentMedia.type === 'tv' && season && episode) {
            mediaToSave.lastSeason = season;
            mediaToSave.lastEpisode = episode;
        }

        const index = watchedMedia.findIndex(m => m.id === currentMedia.id && m.type === currentMedia.type);
        if (index !== -1) watchedMedia.splice(index, 1);
        watchedMedia.unshift(mediaToSave);
        if (watchedMedia.length > 10) watchedMedia = watchedMedia.slice(0, 10);
        localStorage.setItem('watchedMedia', JSON.stringify(watchedMedia));

        $('#info-card').removeClass('active');
        embedPlayer(currentMedia.imdbId, currentMedia.type, season, episode, selectedSource, currentMedia.id);
    });

    function updateNextEpisodeButton() {
        const btn = $('#next-episode-btn');
        btn.hide().off('click');

        if (currentMedia && currentMedia.type === 'tv' && currentPlayback.season && currentPlayback.episode) {
            const realSeasons = (currentMedia.seasons || []).filter(s => s.season_number >= 1);
            if (realSeasons.length === 0) return;

            const currentSeasonData = realSeasons.find(s => s.season_number == currentPlayback.season);
            if (!currentSeasonData) return;

            const totalEpisodes = currentSeasonData.episode_count || 0;
            if (totalEpisodes <= 0 || parseInt(currentPlayback.episode) >= totalEpisodes) return;

            if (typeof currentPlayback.currentEpisodeIndex !== 'number') {
                currentPlayback.currentEpisodeIndex = parseInt(currentPlayback.episode) - 1;
            }

            const nextIndex = currentPlayback.currentEpisodeIndex + 1;

            if (nextIndex < totalEpisodes) {
                const nextEpisode = nextIndex + 1;

                btn.show().on('click', function() {
                    currentPlayback.currentEpisodeIndex = nextIndex;
                    currentPlayback.episode = nextEpisode;

                    const source = $('#source-selector').val() || 'player.autoembed.cc';
                    let cleanId = (currentMedia.id || currentMedia.imdbId).toString();
                    if (cleanId.startsWith('tt')) cleanId = cleanId.replace('tt', '');

                    let nextUrl;
                    switch (source) {
                        case 'player.autoembed.cc':
                            nextUrl = `https://player.autoembed.cc/embed/tv/${cleanId}/${currentPlayback.season}/${nextEpisode}`;
                            break;
                        case 'vidlink.pro':
                            nextUrl = `https://vidlink.pro/tv/${cleanId}/${currentPlayback.season}/${nextEpisode}`;
                            break;
                        case 'vidbinge.to':
                            nextUrl = `https://vidbinge.to/tv/${cleanId}/${currentPlayback.season}/${nextEpisode}`;
                            break;
                        case 'vidsrc.cc':
                            nextUrl = `https://vidsrc.cc/v2/embed/tv/${cleanId}/${currentPlayback.season}/${nextEpisode}`;
                            break;
                        default:
                            nextUrl = `https://player.autoembed.cc/embed/tv/${cleanId}/${currentPlayback.season}/${nextEpisode}`;
                    }

                    $('#player-iframe').attr('src', nextUrl);
                    showPlayerInfo();
                    updateNextEpisodeButton();
                });
            }
        }
    }

    function embedPlayer(mediaId, type, season = null, episode = null, source = 'player.autoembed.cc', tmdbId = null) {
        let cleanId = mediaId.toString();
        if (!cleanId.startsWith('tt') && tmdbId) cleanId = tmdbId.toString();
        else if (!cleanId.startsWith('tt')) cleanId = 'tt' + cleanId;

        currentPlayback = { id: mediaId, type, season, episode };
        currentPlayback.currentEpisodeIndex = parseInt(episode || 1) - 1;

        let url;

        switch (source) {
            case 'player.autoembed.cc':
                url = type === 'movie' 
                    ? `https://player.autoembed.cc/embed/movie/${cleanId}` 
                    : `https://player.autoembed.cc/embed/tv/${cleanId}/${season || 1}/${episode || 1}`;
                break;
            case 'vidlink.pro':
                url = type === 'movie' 
                    ? `https://vidlink.pro/movie/${cleanId}` 
                    : `https://vidlink.pro/tv/${cleanId}/${season || 1}/${episode || 1}`;
                break;
            case 'vidbinge.to':
                url = type === 'movie' 
                    ? `https://vidbinge.to/movie/${cleanId}` 
                    : `https://vidbinge.to/tv/${cleanId}/${season || 1}/${episode || 1}`;
                break;
            case 'vidsrc.cc':
                url = type === 'movie' 
                    ? `https://vidsrc.cc/v2/embed/movie/${cleanId}` 
                    : `https://vidsrc.cc/v2/embed/tv/${cleanId}/${season || 1}/${episode || 1}`;
                break;
            default:
                url = `https://player.autoembed.cc/embed/movie/${cleanId}`;
        }

        const iframe = $('#player-iframe');
        iframe.attr('src', url);
        $('#player-overlay').removeClass('hidden');

        showPlayerInfo();
        updateNextEpisodeButton();

        iframe.off('load').on('load', function() {
            try {
                const video = this.contentWindow.document.querySelector('video');
                if (video) {
                    const key = type === 'movie' ? `playback_${mediaId}` : `playback_${mediaId}_${season}_${episode}`;
                    const saved = localStorage.getItem(key);
                    if (saved) video.currentTime = parseFloat(saved);
                    setInterval(() => {
                        if (!isNaN(video.currentTime)) localStorage.setItem(key, video.currentTime);
                    }, 1500);
                }
            } catch (e) {}
        });
    }

    $('#close-player').click(function() {
        $('#player-iframe').attr('src', '');
        $('#player-overlay').addClass('hidden');
        currentMedia = null;
        currentPlayback = { id: null, type: null, season: null, episode: null, currentEpisodeIndex: null };
    });

    $('#toggle-fullscreen').click(function() {
        const iframe = $('#player-iframe');
        iframe.toggleClass('fullscreen');
        const icon = $('#toggle-fullscreen i');
        icon.toggleClass('fa-expand fa-compress');
    });

    function loadHomeTab() {
        fetchMedia('featured', sectionState['featured'].page);
        fetchMedia('featured-tv', sectionState['featured-tv'].page);
        const watched = JSON.parse(localStorage.getItem('watchedMedia') || '[]');
        if (watched.length === 0) {
            $('#watched-content').html('<p class="empty-message">No watched media yet.</p>');
        } else {
            renderMedia('watched', watched.slice(0, 10), null);
        }
        fetchMedia('trending', sectionState['trending'].page);
        fetchMedia('trending-tv', sectionState['trending-tv'].page);
        fetchMedia('top-rated', sectionState['top-rated'].page);
        fetchMedia('top-rated-tv', sectionState['top-rated-tv'].page);
    }

    function loadSearchTab() {
        const q = $('#search-input').val().trim();
        sectionState['search-movie'].query = q;
        sectionState['search-tv'].query = q;
        sectionState['search-movie'].page = 1;
        sectionState['search-tv'].page = 1;
        if (q) {
            fetchMedia('search-movie', 1, q);
            fetchMedia('search-tv', 1, q);
        } else {
            $('#search-movie-content, #search-tv-content').html('<p class="empty-message">Start typing to search...</p>');
        }
        let timeout;
        $('#search-input').off('input').on('input', function() {
            clearTimeout(timeout);
            timeout = setTimeout(() => loadSearchTab(), 400);
        });
    }

    function loadFavoritesTab() {
        const favs = JSON.parse(localStorage.getItem('favoriteMedia') || '[]');
        const movies = favs.filter(m => m.type === 'movie');
        const tvs = favs.filter(m => m.type === 'tv');
        if (movies.length === 0) $('#favorites-movie-content').html('<p class="empty-message">No favorite movies yet.</p>');
        else renderMedia('favorites-movie', movies, 'movie');
        if (tvs.length === 0) $('#favorites-tv-content').html('<p class="empty-message">No favorite TV shows yet.</p>');
        else renderMedia('favorites-tv', tvs, 'tv');
    }

    function loadProfileTab() {
        $('#profile-username').text(localStorage.getItem('username') || 'Guest');
    }

    $('.tab-link').on('click', function() {
        switchTab($(this).data('tab'));
    });

    $(document).on('click', '[id$="-prev"]', function() {
        const section = $(this).attr('id').replace('-prev', '');
        if (sectionState[section].page > 1) {
            sectionState[section].page--;
            fetchMedia(section, sectionState[section].page, sectionState[section].query);
        }
    });

    $(document).on('click', '[id$="-next"]', function() {
        const section = $(this).attr('id').replace('-next', '');
        if (sectionState[section].page < sectionState[section].totalPages) {
            sectionState[section].page++;
            fetchMedia(section, sectionState[section].page, sectionState[section].query);
        }
    });

    $('#logout-button').click(function() {
        localStorage.clear();
        switchView('main-view');
        loadHomeTab();
    });

    $('#dark-mode-toggle').change(function() {
    });

    switchView('main-view');
    loadHomeTab();

    function showPlayerInfo() {
        if (!currentMedia) return;

        $('.player-info .info-card-title').text(currentMedia.title || 'Unknown Title');
        $('.player-info .info-card-description').text(currentMedia.overview || 'No description available.');
        $('.player-info .info-card-cast').text('Cast information not available in this view.');
        $('.player-info .info-card-rating').text(`Rating: ${currentMedia.rating > 0 ? currentMedia.rating : 'N/A'}/10`);

        let favs = JSON.parse(localStorage.getItem('favoriteMedia') || '[]');
        const isFavorited = favs.some(m => m.id === currentMedia.id && m.type === currentMedia.type);

        const playerFavBtn = $('.player-info .info-card-favorite');
        playerFavBtn.html(isFavorited 
            ? '<i class="fas fa-heart"></i> Remove from Favorites'
            : '<i class="far fa-heart"></i> Add to Favorites'
        );

        playerFavBtn.off('click').on('click', function() {
            if (isFavorited) {
                favs = favs.filter(m => !(m.id === currentMedia.id && m.type === currentMedia.type));
                localStorage.setItem('favoriteMedia', JSON.stringify(favs));
                loadFavoritesTab();
                playerFavBtn.html('<i class="far fa-heart"></i> Add to Favorites');
            } else {
                favs.unshift(currentMedia);
                if (favs.length > 20) favs = favs.slice(0, 20);
                localStorage.setItem('favoriteMedia', JSON.stringify(favs));
                loadFavoritesTab();
                playerFavBtn.html('<i class="fas fa-heart"></i> Remove from Favorites');
            }
        });
    }

    initParticles();
});