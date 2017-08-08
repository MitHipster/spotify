/*jslint esversion: 6, browser: true*/
/*global window, console, $, jQuery, Lorem, alert*/

const $cardContainer =  $('.card-container');
const $loginBtn = $('#btn-login');
const $searchField = $('#search');
const $searchBtn = $('#btn-search');
const $searchTerm = $('#search-term');
const $sortContainer = $('.sort-container');
const $sortInput = $('.sort-selection');
const loginBtn = 'btn-login';
let accessToken = '';
let searchResults = [];
let randomUsers = [];
const randomUserCnt = 250;
const commentsMin = 2;
const commentsMax = 10;
const wordsMin = 10;
const wordsMax = 25;
let lgDynamicEl = []; // Dynamic LightGallery dataset
let stateKey = 'spotify_auth_state';
const messages = [
  'There was an error during the authentication. Please try again.',
  'You are logged in. Use the field above to search for albums by artist.',
  'Please log in to Spotify to grant this site access.',
  'No match found. Please revise your search term.'
];

$(document).ready(function() {
  /** Thanks to José Manuel Pérez Implicit Grant
  ** example on GitHub
  */

  /**
   * Obtains parameters from the hash of the URL
   * @return Object
   */
   // Function to get token and other hash information from URL
  function getHashParams() {
    let hashParams = {};
    let e, r = /([^&;=]+)=?([^&;]*)/g,
        q = window.location.hash.substring(1);
    while (e = r.exec(q)) {
       hashParams[e[1]] = decodeURIComponent(e[2]);
    }
    return hashParams;
  }

  /**
   * Generates a random string containing numbers and letters
   * @param  {number} length The length of the string
   * @return {string} The generated string
   */
   // Function to generate a random string used to increase authentication reliability by setting optional state parameter
  function generateRandomString(length) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  let params = getHashParams();

  accessToken = params.access_token;
  let state = params.state,
      storedState = localStorage.getItem(stateKey);
  // If access token exists, but state is missing, show authentication error message
  if (accessToken && (state == null || state !== storedState)) {
    $cardContainer.append(`<p id="message">${messages[0]}</p>`);
  // Else hide log in button and show authentication successful message
  } else {
    // If access token and state exists, hide log in button and show authentication successful message
    // localStorage.removeItem(stateKey);
    if (accessToken) {
      $loginBtn.hide();
      $cardContainer.append(`<p id="message">${messages[1]}</p>`);
    // Else there is no access token and user must log in
    } else {
      $loginBtn.show();
      $cardContainer.append(`<p id="message">${messages[2]}</p>`);
    }
    // Log in click event that directs user to spotify to authenticate then redirects back to site, supplying an access token and state
    document.getElementById(loginBtn).addEventListener('click', function() {

      let client_id = '75dcf1660ea04c6ba07aaafb9b5735a5'; // Your client id
      let redirect_uri = 'https://mithipster.github.io/spotify/'; // Your redirect uri

      let state = generateRandomString(16);

      localStorage.setItem(stateKey, state);
      let scope = 'user-top-read';

      let url = 'https://accounts.spotify.com/authorize';
      url += '?response_type=token';
      url += '&client_id=' + encodeURIComponent(client_id);
      url += '&scope=' + encodeURIComponent(scope);
      url += '&redirect_uri=' + encodeURIComponent(redirect_uri);
      url += '&state=' + encodeURIComponent(state);

      window.location = url;

    }, false);
  }
});

// Keypress function on the search field that triggers the search button's click event when pressing enter
$searchField.on('keypress', function (e) {
  if (e.which == 13) {
    $searchBtn.click();
  }
});

// Click function to submit search term to Spotify API via AJAX request
$searchBtn.on('click', function () {
  let searchValue = $searchField.val();
  // Clear any previous results
  $cardContainer.empty();
  // AJAX request to retrieve search results from Spotify
  $.ajax({
    url: 'https://api.spotify.com/v1/search',
    headers: {
      'Authorization': 'Bearer ' + accessToken
    },
    data: {
      q: `artist:"${searchValue}"`,
      type: 'album',
      market: 'US'
    },
    success: (results) => {
      let albumList = '';
      // If albums are returned continue else show no results found message
      if (results.albums.items.length !== 0) {
        // Call function to generate album list for subsequent AJAX request
        albumList = albumIdList(results.albums.items);
        // Add search term to message
        $searchTerm.text($searchField.val());
        // Remove active class if applicable
        $sortInput.removeClass('active');
        // Clear search field
        $searchField.val('');

        // AJAX request to retrieve detailed album information based on earlier search results
        $.ajax({
          url: 'https://api.spotify.com/v1/albums/',
          headers: {
            'Authorization': 'Bearer ' + accessToken
          },
          data: {
            ids: albumList,
            market: 'US'
          },
          success: (results) => {
            // Populate global array with returned albums
            searchResults = results.albums;
            // AJAX request to retrieve random user information
            $.ajax({
              url: 'https://randomuser.me/api/',
              data: {
                results: randomUserCnt,
                inc: 'picture,login',
                nat: 'us'
              },
              success: function(users) {
                // Populate global array with returned users
                randomUsers = users.results;
                //Call function to add random users and comments into the Spotify search results
                addCommentBlock(searchResults, randomUsers);
                // Call function to create album cards
                albumResults(searchResults);
                // Call function to create album detail for LightGallery
                albumObjArray(searchResults);
                // Show sort options and used search term
                $sortContainer.show();
              } // end random user success callback function
            }); // end random user AJAX request
          } // end second Spotify success callback function
        }); // end second Spotify AJAX request
      // else diplay a message that no match was found
      } else {
        $sortContainer.hide(0);
        $cardContainer.append(`<p id="message">${messages[3]}</p>`);
      }
    } // end first Spotify success callback
  }); // end first Spotify AJAX request
});

// Click function to capture sort request
$sortInput.on('click', function () {
  let sortOrder = $(this).data('sort');
  // Remove active class if applicable and add back class on clicked link
  $sortInput.removeClass('active');
  $(this).addClass('active');
  // Clear any previous results
  $cardContainer.empty();
  lgDynamicEl = [];
  // Call search function and pass sort order option
  searchResults.sort(sortYearReleased(sortOrder));
  // Call function to create album cards
  albumResults(searchResults);
  // Call function to create album detail for LightGallery
  albumObjArray(searchResults);
});

// Click function for More Info button collection to call LightGallery lightbox plugin
$cardContainer.on('click', '.btn-info', function (e) {
  e.preventDefault();
  // Get index data from button to set starting point for lightbox
  let i = $(this).data('index');

  // LightGallery plugin
  $(this).lightGallery({
    dynamic: true,
    // Dynamic dataset base on search results
    dynamicEl: lgDynamicEl,
    index: i,
    mode: 'lg-fade',
    speed: 200,
    width: '560px',
    hideBarsDelay: 600000,
    addClass: 'lg-custom',
    getCaptionFromTitleOrAlt: false,
    download: false
  }).on('onAfterAppendSubHtml.lg', function () {
    // Call MediaElement constructor after appending album detail to style player for song samples
    $('audio').mediaelementplayer({
      enableAutosize: false,
      alwaysShowControls: true,
      features: ['playpause'],
      success: function (mediaElement, originalNode) {
        mediaElement.load();
      }
    });
    // Click function to select lightbox section
    $('.lg-section').on('click', function () {
      // Remove active class if applicable and add back class on clicked link
      $('.lg-section').removeClass('active');
      $(this).addClass('active');
    });
    // Return focus to top of section after displaying another album
    $('.lg-sub-html').scrollTop(0);
  }); // end LightGallery constructor
}); // .btn-info click function

// Build a comma-separated list of the album IDs for subsequent AJAX request
let albumIdList = (albums) => {
  let albumList = '';

  $.each(albums, (i, album) => {
    albumList += (album.id + ',');
  }); // end each album iterator
  // Remove last comma and return list
  return albumList.slice(0, -1);
}; // end albumIdList function

// Function to add random users and comments to the returned Spotify object
let addCommentBlock = (albums, users) => {
  // Iterate over search results and add a random number of users and comments to each album object
  $.each(albums, (i, album) => {
    // Get a random number of comments to create
    let comments = randomItemRange(commentsMin, commentsMax);
    album.users = [];
    // Loop through comment count and randomly select users from the random users object
    for (let c = 0; c < comments; c++) {
      // Get a random number for user
      let user = randomItemRange(0, randomUserCnt - 1);
      // Get a random number of words to combine
      let words = randomItemRange(wordsMin, wordsMax);
      // Call Lorem plugin to generate a random comment
      let commentText = Lorem.prototype.createText(words, 3);
      // Create user object
      let obj = {
        image: users[user].picture.large,
        name: users[user].login.username,
        comment: sentence(commentText)
      };
      // Add user object to new users array
      album.users[c] = obj;
    } // for comments loop
  });// end each album iterator
}; // end albumIdList function

// Iterate over search results to create a card that holds the album information for each object
let albumResults = (albums) => {
  let artistName = '';

  $.each(albums, (i, album) => {
    // Get medium-sized image with height and width ~300px
    let coverUrl = album.images[1].url;
    let albumName = album.name;
    let releaseDate = album.release_date.slice(0, 4);
    // Call function to create artist name(s)
    artistName = artistList(album.artists);

    // Call function to generate HTML for the cards and append to the card container ul
    $cardContainer.append(cardHtml(i, coverUrl, albumName, artistName, releaseDate));
  }); // end each album iterator
}; // end albumResults function

// Combine multiple artist names into a string
let artistList = (artists) => {
  let artistNames = '';

  $.each(artists, (i, artist) => {
    artistNames += artist.name + ' / ';
  }); // end each artist iterator
  // Remove last set of " / " and return list
  return artistNames.slice(0, -3);
}; // end artistList function

// Function to generate the card HTML with album image and name, plus insert album ID as a data attribute in the More Info link
let cardHtml = (i, coverUrl, albumName, artistName, releaseDate) => {
  // Create the HTML using a template literal
  let html =
      `<li class="card">
        <figure>
          <div class="image-overlay">
            <img class="card-image"
            src="${coverUrl}"
            alt="${albumName} album cover">
            <div class="btn-overlay">
              <a href="#0" class="btn-info" data-index="${i}">More Info</a>
            </div>
          </div>
          <figcaption class="card-name">${albumName}</figcaption>
          <p class="card-artist">${artistName} (${releaseDate})</p>
        </figure>
      </li>`;

  return html;
}; // end cardHtml function

// Iterate over album tracks to create a list for the More Info area
let albumTracks = (tracks) => {
  let html = '';
  $.each(tracks, (i, track) => {
    let trackPreview = track.preview_url;
    // If track prview null, set to empty string.
    if (!trackPreview) trackPreview = '';
    let trackNum = track.track_number;
    let trackName = track.name;
    let trackDuration = msConvert(track.duration_ms);

    // Call function to generate HTML for album tracks
    html += trackHtml(trackPreview, trackNum , trackName, trackDuration);
  }); // end each track iterator
  return html;
}; // end albumTracks function

// Function to generate the track HTML with preview link, name, number and duration
let trackHtml = (trackPreview, trackNum , trackName, trackDuration) => {
  // Create the HTML for album track using a template literal
  let trackSample = '';
  if (!trackPreview) {
    trackSample = '<img src="icons/icon-not.svg" class="lg-not" alt="Not available">';
  } else {
    trackSample = `<audio controls class="lg-track-sample mejs__custom" src="${trackPreview}"></audio>`;
  }
  let html =
      `<li class="lg-track">
        ${trackSample}
        <p class="lg-track-num">${trackNum}</p>
        <p class="lg-track-name">${trackName}</p>
        <p class="lg-track-duration">${trackDuration}</p>
      </li>`;

  return html;
}; // end trackHtml function

// Iterate over user comments to create a list for the More Info area
let albumComments = (users) => {
  let html = '';
  $.each(users, (i, user) => {
    let userImage = user.image;
    let userName = user.name;
    let userComment = user.comment;

    // Call function to generate HTML for user comments
    html += commentHtml(userImage, userName , userComment);
  }); // end each user iterator
  return html;
}; // end albumComments function


// Function to generate the comment HTML with user image, user name and random lorem ipsum text
let commentHtml = (userImage, userName, userComment) => {
  // Create the HTML for user comment using a template literal
  let html =
      `<li class="lg-comment">
        <img class="lg-user-image" src="${userImage}" alt="${userName}'s profile image">
        <div>
          <div class="lg-comment-header">
            <p class="lg-user-name">${userName}</p>
            <p class="lg-posted"><img src="icons/icon-clock.svg" alt=""> hrs ago</p>
          </div>
          <p class="lg-user-comment">${userComment}</p>
        </div>
      </li>`;

  return html;
}; // end commentHtml function

// Function to create an array of album objects for use as dynamic LightGallery dataset
let albumObjArray = (albums) => {
  let obj = {};
  let artistName = '';
  let trackList = '';
  let commentList = '';
  // Clear array of earlier search results
  lgDynamicEl = [];
  $.each(albums, (i, album) => {
    let coverUrl = album.images[0].url;
    let albumRelease = album.release_date.slice(0, 4);
    // Call function to create artist name(s)
    artistName = artistList(album.artists);
    // Call function to create album tracks
    trackList = albumTracks(album.tracks.items);
    // Call function to create user comments
    commentList = albumComments(album.users);
    obj = {
      'src': coverUrl,
      'subHtml':
        `<div class="lg-nav-container">
          <p class="lg-nav">
            <span>Sections: </span>
            <a href="#album" class="lg-section active">album</a><span class="lg-forward-slash">&#47;</span>
            <a href="#tracks" class="lg-section">tracks</a><span class="lg-forward-slash">&#47;</span>
            <a href="#comments" class="lg-section">comments</a>
          </p>
        </div>
        <div class="lg-album-details">
          <span class="anchor" id="album"></span>
          <div class="lg-album-info">
            <p class="lg-album"><span>Album Title: </span>${album.name}</p>
            <p class="lg-artist"><span>Artist: </span>${artistName}</p>
            <p class="lg-label"><span>Label: </span>${album.label}</p>
            <p class="lg-release-date"><span>Released: </span>${albumRelease} (${album.album_type})</p>
            <span class="anchor" id="tracks"></span>
            <p><span>Tracks: </span></p>
          </div>
          <ul class="lg-track-container">
            ${trackList}
          </ul>
          <span class="anchor" id="comments"></span>
          <p><span>Comments: </span></p>
          <ul class="lg-comment-container">
            ${commentList}
          </ul>
        </div>`
    };
    lgDynamicEl.push(obj);
  }); // end each album iterator
}; // end albumObjArray function

//============================================================
// Helper Functions
//============================================================

// Function to sort albums by year released
let sortYearReleased = (sort) => {
  return function (a, b) {
    let aYear = a.release_date;
    let bYear = b.release_date;
    // Include month in sort if provided else default month to 12
    aYear = (aYear.length === 4) ? aYear + "12" : aYear.slice(0, 7).replace('-', '');
    bYear = (bYear.length === 4) ? bYear + "12" : bYear.slice(0, 7).replace('-', '');
    // If sort option is 'asc' sort ascending else default to descending
    if (sort === 'asc') {
      return ((aYear < bYear) ? -1 : ((aYear > bYear) ? 1 : 0));
    } else {
      return ((aYear < bYear) ? 1 : ((aYear > bYear) ? -1 : 0));
    }
  };
};

// Function to convert track duration from ms to minutes:seconds
let msConvert = (duration) => {
  let seconds = parseInt((duration / 1000) % 60);
  let minutes = parseInt((duration / (1000 * 60)) % 60);

  seconds = (seconds < 10) ? "0" + seconds : seconds;

  return minutes + ":" + seconds;
}; // end msConvert function

// Function to return a random number for creating simulated user comments
let randomItemRange = (minItems, maxItems) => {
  return Math.floor(Math.random() * (maxItems - minItems + 1)) + minItems;
}; // end randomItemRange function

// Function to capitalize first letter of string and add ending punctuation
let sentence = (comment) => {
  return comment.charAt(0).toUpperCase() + comment.slice(1) + '.';
}; // end sentence function
