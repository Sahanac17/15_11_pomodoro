# Pomodoro Art

A calm Pomodoro timer with a twist: while you focus, a real painting slowly comes into view.

A Pomodoro timer is a countdown you use to work in short, focused bursts. This one shows a painting from the Metropolitan Museum of Art in New York. The painting starts very blurry and gets a little clearer every second. When the time is up, it is fully sharp.

## How it works

- **Start** begins the countdown. The painting starts blurred.
- **Pause** stops the countdown. The button then says **Resume**, which carries on from where you stopped.
- **Reset** puts the timer back to the full time. You keep the same painting, and it goes blurry again.
- **The timer length** is set inside the code (in `script.js`). It is not a button on the page yet. It is **currently set to 15 seconds so it is quick to test**. The plan is 25 minutes, the usual Pomodoro length.
- **At 00:00:**
  - The painting is fully sharp.
  - A soft bell rings.
  - The painting's name, artist and year appear, with a link to read about it on the Met Museum's website. The link opens in a new tab. If the Met doesn't list the artist or year, the page says "Unknown".
  - **Restart session** picks a brand-new painting and starts over.

The painting's details stay hidden until the timer finishes, so you don't find out what it is early.

## Where the paintings come from

The paintings come from the Metropolitan Museum of Art's free [Collection API](https://metmuseum.github.io/). (An API is a way for one website to ask another for information.)

- **No API key is needed.** The app doesn't use one.
- Each time, the app picks a random painting. It only uses paintings that are in the public domain (free for everyone to use) and that have a picture.
- The picture, name, artist, year and link all come straight from the Met. Nothing is made up.

## What happens when something goes wrong

- If a painting has no picture or isn't suitable, the app quietly tries another one (up to 5 different paintings).
- If the Met doesn't answer within about 10 seconds, or sends back an error, the app stops trying and shows this message where the painting would be:

  > We couldn't load a painting right now. You can still use the timer. Refresh the page to try again.

- **The timer and its buttons still work** even when there is no painting.

## Live link

[add live link here]

## Credits

- Paintings and painting details: [The Metropolitan Museum of Art](https://www.metmuseum.org/) and its open-access Collection API.
- Built by [your name].
