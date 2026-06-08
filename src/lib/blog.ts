export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string; // ISO yyyy-mm-dd
  readMins: number;
  author: string;
  tags: string[];
  body: string; // lightweight markdown: ## h2, ### h3, - bullets, **bold**, paragraphs
}

export const POSTS: BlogPost[] = [
  {
    slug: "disc-golf-rules-beginners-guide",
    title: "Disc Golf Rules: A Simple Guide for New Players",
    excerpt: "The complete beginner's guide to disc golf rules — how scoring works, what counts as out-of-bounds, the order of play, and the etiquette that matters.",
    category: "Getting Started",
    date: "2026-06-04",
    readMins: 6,
    author: "Radius Team",
    tags: ["rules", "beginner", "how to play"],
    body: `Disc golf is wonderfully simple: get the disc in the basket in as few throws as possible. But a handful of rules and etiquette points will make you look like a regular on day one.

## The basics
- Each hole starts from the **tee pad** and ends when your disc comes to rest in the **basket** (chains + cage).
- Your **score** is the number of throws it took. Lowest total wins.
- Like ball golf, holes have a **par** — the expected number of throws for a skilled player.

## Order of play
- On the tee, the player with the **best score on the previous hole throws first** (this is "honors").
- After the tee, whoever's disc is **farthest from the basket throws next**.

## Where do you throw from?
You throw from directly behind where your disc landed — your **lie**. Place a mini-marker disc at the front of your disc, then throw with a supporting point behind it.

## Out-of-bounds (OB)
If your disc lands in a marked OB area (water, roads, past a line), you take a **one-throw penalty** and play from where it went out (or a drop zone). Always check the local OB rules on the tee sign.

## Putting rule (inside the circle)
Within **10 meters (33 feet)** of the basket, you can't follow through past your marker — no "jump putts." Keep your balance until the disc lands.

## Etiquette that matters
- **Stay still and quiet** while others throw.
- Let faster groups **play through**.
- **Don't throw** until the group ahead is clear — safety first.
- **Pack out your trash** and respect the course.

## The takeaway
You don't need to memorize a rulebook to start. Throw, find it, throw again, count your strokes, and be courteous. Track your rounds in Radius and the scoring takes care of itself.`,
  },
  {
    slug: "how-far-should-you-throw",
    title: "How Far Should You Throw a Disc? Distance by Skill Level",
    excerpt: "Wondering if your distance is normal? Here are realistic disc golf driving distances by skill level — and the fastest ways to add more.",
    category: "Improve",
    date: "2026-06-03",
    readMins: 6,
    author: "Radius Team",
    tags: ["distance", "improve", "technique"],
    body: `"How far should I be throwing?" is the most common question in disc golf. The honest answer: probably less than you think — and that's fine. Here's what's realistic.

## Average distances by skill level
- **Brand-new players:** 150–225 feet
- **Casual / intermediate:** 250–325 feet
- **Advanced amateurs:** 350–425 feet
- **Touring pros:** 450–550+ feet

If you're a new player throwing 200 feet, you're **completely normal**. Distance comes with time.

## Distance doesn't win rounds — accuracy does
The fastest way to lower your score isn't another 50 feet off the tee. It's **hitting your lines, avoiding OB, and putting well**. A 300-foot player who stays in bounds beats a 400-foot player who's in the woods every hole.

## The fastest ways to add distance
### 1. Snap, not muscle
Distance comes from **wrist snap and timing**, not arm strength. A late, sharp snap creates spin — and spin carries the disc.

### 2. Use the right disc
Throwing a disc that's **too overstable or too fast** for your arm kills distance. Lighter, understable discs go farther for most players. Check a disc's flight numbers before you buy.

### 3. Reach back and stay smooth
A full, smooth reach-back with a relaxed arm beats a tense, rushed throw every time. Slow is smooth, smooth is far.

### 4. Footwork
A balanced **X-step** transfers your body weight into the throw. Most amateur distance is left on the table from poor footwork, not weak arms.

## Track your progress
The best motivation is watching your numbers climb. Log your throws and your max distance in Radius, and compare discs in the database to find the ones that fly farthest **for you**.`,
  },
  {
    slug: "best-discs-for-beginners",
    title: "The Best Discs for Beginners (and Why)",
    excerpt: "New to disc golf? Skip the heavy distance drivers. Here's the simple 3-disc starter setup that actually helps you improve faster.",
    category: "Getting Started",
    date: "2026-06-02",
    readMins: 5,
    author: "Radius Team",
    tags: ["beginner", "discs", "gear"],
    body: `If you walk into a shop and grab the same disc the pros bag, you'll probably have a bad time. Pros throw fast, overstable discs because they generate huge arm speed. Beginners don't — yet. The right beginner discs are **lighter, slower, and more understable**, which means they fly straight (and far) without perfect technique.

## Start with three discs
You don't need a full bag. You need a **putter, a midrange, and a fairway driver** — that's it.

### 1. A putter (Speed 2–3)
Used for putting *and* short, accurate approach shots. A straight, beadless putter is the most-thrown disc in any good player's bag. Learn to trust it inside the circle.

### 2. A midrange (Speed 4–5)
Your most reliable disc. Stable midranges go where you aim and resist the wind. This is the disc that will lower your scores the fastest.

### 3. An understable fairway driver (Speed 6–7)
Forget speed-12 distance drivers. A lighter, understable fairway driver will go **farther** for you than a fast driver you can't turn over. Look for a negative turn number.

## Why lighter weights help
A 150–160g disc needs far less power to fly correctly than a 175g disc. More glide, less fade, more distance for the same throw. As your arm speed grows, you can add heavier and faster discs.

## The takeaway
Buy a putter, a stable mid, and an understable fairway driver — all on the lighter side. Throw them until they feel like part of your arm. You'll improve faster than the player with 18 drivers they can't control.

Want to see flight numbers for any disc? Browse the full **Radius disc database** to compare speed, glide, turn, and fade side by side.`,
  },
  {
    slug: "flight-numbers-explained",
    title: "Disc Golf Flight Numbers Explained (Speed, Glide, Turn, Fade)",
    excerpt: "Those four numbers on every disc actually tell you exactly how it flies. Here's how to read them — and pick discs that match your game.",
    category: "Gear",
    date: "2026-05-28",
    readMins: 6,
    author: "Radius Team",
    tags: ["flight numbers", "gear", "discs"],
    body: `Every disc has four numbers — like **12 / 5 / -1 / 3**. They're the disc's flight rating: **Speed, Glide, Turn, Fade**, in that order. Learn to read them and you'll never buy the wrong disc again.

## Speed (1–14)
How fast the disc needs to travel to fly as designed. High-speed drivers (10–14) need a lot of arm speed. If you can't throw them fast enough, they'll just fade out early. Beginners fly **lower-speed** discs farther.

## Glide (1–7)
How well the disc stays aloft. Higher glide = more distance for the same power, which is why **high-glide discs are great for newer players**. Lower glide gives more control in wind and on touchy approaches.

## Turn (+1 to -5)
The disc's tendency to turn **right** (for a right-handed backhand) during the fast part of the flight. A more negative number = more **understable** = easier to turn over and great for beginners, rollers, and turnover shots.

## Fade (0–5)
How hard the disc hooks **left** (RHBH) at the end of the flight as it slows down. Higher fade = more **overstable** = reliable in wind and for forehands.

## Stability in one number
Add **Turn + Fade** for a quick stability read:
- **Negative** → understable (turns right, finishes gentle)
- **Around 0–1.5** → stable / straight
- **Higher** → overstable (dependable left finish)

## Putting it together
A **12 / 5 / -1 / 3** is a fast, glidey distance driver that turns a little then fades hard — a workhorse for strong arms. A **5 / 5 / -2 / 1** is an easy, flippy midrange perfect for beginners.

On every Radius disc page you'll see these numbers, the stability, and a flight-path chart — plus a tool to overlay discs and compare flights directly.`,
  },
  {
    slug: "how-to-throw-a-forehand",
    title: "How to Throw a Forehand (Flick): A Step-by-Step Guide",
    excerpt: "The forehand opens up shots a backhand can't reach. Here's how to build a clean, repeatable flick from grip to follow-through.",
    category: "Technique",
    date: "2026-05-20",
    readMins: 7,
    author: "Radius Team",
    tags: ["technique", "forehand", "form"],
    body: `A reliable forehand (or "flick") lets you attack shots that curve the opposite way of your backhand — and it's a lifesaver in the woods. Here's how to build one.

## 1. The grip
Two fingers (index + middle) along the inside rim, thumb on top. The **fork grip** (fingers split) gives control; the **stacked grip** (fingers together) gives power. Grip firmly — a loose forehand wobbles.

## 2. Disc selection
Start **overstable**. Understable discs turn and burn (roll away) on a forehand until your form is dialed. A stable-to-overstable midrange is the perfect learning disc.

## 3. The motion
- Stand side-on to the target, weight back.
- Keep your elbow **in front of your body** — don't let it drift behind you.
- Pull the disc forward in a tight, compact motion, snapping the wrist at release.
- The disc should come out **flat or slightly nose-down**.

## 4. The snap
Power comes from **wrist snap**, not arm strength. Think of cracking a whip. A late, sharp snap creates spin — and spin is what keeps the disc stable and flying far.

## 5. Common mistakes
- **Nose up** → the disc stalls and dumps. Release flatter.
- **Too much arm, no snap** → wobble and short distance.
- **Understable disc** → it rolls. Throw something more overstable while learning.

## Practice it
Start at 50% power with a stable mid. Groove the motion before you add distance. Ten clean reps beat fifty wild ones. Track your throws in the Radius app to see which discs you actually trust on the forehand.`,
  },
  {
    slug: "putting-drills-that-lower-your-score",
    title: "Putting Drills That Actually Lower Your Score",
    excerpt: "Putting is the fastest way to cut strokes — and the most neglected. Three simple drills that build real confidence inside the circle.",
    category: "Practice",
    date: "2026-05-12",
    readMins: 5,
    author: "Radius Team",
    tags: ["putting", "practice", "scoring"],
    body: `Drive for show, putt for dough. Nothing lowers your score faster than making the putts you're *supposed* to make. Here are three drills that work.

## Why putting matters most
A missed 20-footer costs the same stroke as a shanked drive — but it's far more fixable. Most amateurs lose 3–5 strokes a round inside the circle. That's the cheapest improvement in the game.

## Drill 1: The 10-in-a-row ladder
Start at 10 feet. Make **10 in a row**, then step back to 15, then 20. Miss one and you start that distance over. This builds the pressure of *needing* to make it — exactly like a real round.

## Drill 2: The circle of 8
Place 8 discs in a circle ~20 feet from the basket. Putt your way around. Track your makes out of 8 every session. Watching that number climb is the most motivating feedback there is.

## Drill 3: Pressure putts
End every practice session with **5 "money" putts** from your make-or-break distance (usually 25–30 feet). Treat each like it's for the win. Training under pressure is the only way to perform under pressure.

## Build a routine
Pick the same stance, grip, and tempo every time. A repeatable routine removes doubt. Putt **every day**, even 15 minutes — consistency beats marathon sessions.

Log your rounds in Radius and watch your Game IQ climb as your circle-1 percentage improves.`,
  },
  {
    slug: "how-to-read-a-disc-golf-hole",
    title: "How to Read a Disc Golf Hole Like a Pro",
    excerpt: "Great scores start before you throw. Here's how to scout a hole, pick the smart line, and avoid the big numbers.",
    category: "Course Management",
    date: "2026-05-04",
    readMins: 6,
    author: "Radius Team",
    tags: ["strategy", "course management", "scoring"],
    body: `The best players aren't just the strongest throwers — they're the smartest. Reading a hole before you throw is how you turn bogeys into pars.

## Find the trouble first
Before you think about the basket, find what you want to **avoid**: OB, water, dense woods, big elevation. Most blow-up holes come from one bad decision, not a bad throw. Plan the shot that keeps the big number off the card.

## Pick your landing zone, not the basket
Aim for the **spot that leaves the easiest next shot** — not always the pin. A safe 250-foot drive to an open fairway beats a hero line that brings OB into play.

## Read the shot shape
- **Right-curving hole (RHBH)?** Throw an understable disc on a hyzer-flip, or a forehand.
- **Left-curving?** A controlled hyzer.
- **Dead straight and tight?** Your most trusted, stable midrange.

## Account for elevation and wind
Uphill plays longer and kills understable flights — club up and expect more fade. Downhill flips discs over — throw more overstable. A headwind makes everything more overstable; a tailwind, less.

## Commit
Indecision is the enemy. Once you've picked the line, **commit fully**. A confident throw on the "B" line beats a tentative throw on the perfect line every time.

## Know the course
The more you know a layout — distances, hazards, par — the smarter you play it. Browse **course layouts, hole-by-hole maps, and leaderboards on Radius** to scout your next round before you even arrive.`,
  },
];

export function getAllPosts(): BlogPost[] {
  return [...POSTS].sort((a, b) => b.date.localeCompare(a.date));
}
export function getPostBySlug(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}

const CAT_COLORS: Record<string, string> = {
  "Getting Started": "#22c55e", // green
  Technique: "#3b82f6", // blue
  Gear: "#8b5cf6", // purple
  "Disc Reviews": "#a855f7", // violet
  Practice: "#f6c165", // gold
  "Course Management": "#ea8b3a", // orange
  Improve: "#14b8a6", // teal
  News: "#ef4444", // red
  "Pro Tour": "#4f46e5", // indigo
  Tournaments: "#f59e0b", // amber
  Players: "#ec4899", // pink
  Courses: "#0ea5e9", // sky
  Culture: "#f43f5e", // rose
  Community: "#06b6d4", // cyan
};
// deterministic vibrant fallback so every category gets color (no dull grey)
const FALLBACK = ["#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#06b6d4", "#ef4444", "#14b8a6"];
export const blogCatColor = (c: string) => CAT_COLORS[c] ?? FALLBACK[[...(c || "")].reduce((a, ch) => a + ch.charCodeAt(0), 0) % FALLBACK.length];
