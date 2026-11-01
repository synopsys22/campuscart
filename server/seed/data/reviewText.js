// Sample review text for the demo, grouped by category. Each entry is [title, body].

const hardware = [
  ['Worked on the first try', 'Plugged it in, flashed a test sketch and it ran. Saved me a lot of time in lab.'],
  ['Good for my mini project', 'Used this for my semester mini project. No issues over two months of regular use.'],
  ['Solid quality', 'Pins are straight and everything is labelled properly. Better than the ones our lab has.'],
  ['Great way to learn', 'Lots of tutorials online work directly with this. I learned more here than in the lectures.'],
];

const computing = [
  ['Handles everything I throw at it', 'Docker, VS Code and about thirty Chrome tabs. It stays smooth and the fans stay quiet.'],
  ['Good for the price', 'Compared a few options in this budget and this was the best fit. Battery lasts through most of a college day.'],
  ['Happy with this purchase', 'Build quality is better than I expected. Compile times are also much shorter than my old machine.'],
];

const peripheral = [
  ['My desk setup is much better now', 'I use this for hours every day and it stays comfortable. Should have bought it in first year.'],
  ['Worth it', 'A little more than I wanted to spend, but it feels well made. No connection problems so far.'],
  ['Does the job well', 'Simple to set up on both Windows and Ubuntu. It works without any extra drivers.'],
  ['Good upgrade', 'Coming from the cheapest option, the difference is obvious. Coding sessions feel a lot nicer.'],
];

const accessory = [
  ['Useful every day', 'Small purchase, but I use it every single day. It feels sturdy too.'],
  ['Exactly what I needed', 'Does what it says. It fits my laptop well and travels easily.'],
  ['Good value', 'Cheaper than the branded one in the local shop and seems just as good.'],
];

const book = [
  ['Clear and thorough', 'Long, but the explanations are clear. It helped a lot with both my exams and my interview prep.'],
  ['Must have for this subject', 'Our professor follows this book closely. The solved examples make the hard chapters manageable.'],
  ['Good print quality', 'Paper and print are good for the price. It arrived well packed with no damage.'],
  ['Worth reading slowly', 'Not a quick read, but I understood topics here that I never got from slides.'],
];

const software = [
  ['Key worked instantly', 'Got the key soon after ordering and it activated right away. No trouble at all.'],
  ['Great for student projects', 'Exactly what I needed for my project. Setup took about five minutes.'],
  ['Good deal', 'Much cheaper than paying monthly. It has been reliable so far.'],
];

const stationery = [
  ['Nice and smooth', 'Good paper and it holds up well through the semester. I bought a second one.'],
  ['Reliable for exams', 'Used it through my end-semester exams with no complaints at all.'],
  ['Simple and good', 'Nothing fancy, but it does the job well and the price is fair.'],
];

const bag = [
  ['Carries everything', 'Laptop, charger, two textbooks and lunch all fit easily. Straps stay comfortable on the long walk to class.'],
  ['Survived the monsoon', 'Got caught in the rain on campus twice and everything inside stayed dry.'],
  ['Good size for college', 'Not too bulky, and the laptop section feels well padded. Happy with it.'],
];

const merch = [
  ['Everyone in my batch asked about it', 'Good material and the print has held up after several washes. The joke lands every time.'],
  ['Great fit', 'Comfortable and the size chart is accurate. I wear it to most lab sessions now.'],
  ['Fun and good quality', 'Better quality than I expected for the price. Bought one for a friend as well.'],
];

const essentials = [
  ['Great for hostel life', 'Very useful in a hostel room. It has held up well over the semester.'],
  ['Good buy', 'Works well and feels solid. I use it pretty much every day.'],
  ['Does what it promises', 'No complaints after a couple of months. Good price for this quality.'],
];

export const reviewTextByCategory = {
  'dev-hardware': hardware,
  laptops: computing,
  peripherals: peripheral,
  'laptop-accessories': accessory,
  'storage-cables': accessory,
  'cs-textbooks': book,
  'software-licenses': software,
  stationery,
  backpacks: bag,
  'college-merch': merch,
  'daily-essentials': essentials,
};
