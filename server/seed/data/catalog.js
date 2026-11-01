// Sample catalog for the demo. Prices are realistic but illustrative.
// Specs are written as [group, key, value]. "art" picks the illustration drawn for the product.

export const categories = [
  { key: 'dev-hardware', name: 'Dev Hardware', icon: 'cpu', description: 'Boards, sensors and tools for labs and side projects.' },
  { key: 'laptops', name: 'Laptops', icon: 'laptop', description: 'Machines that can handle compilers, containers and coursework.' },
  { key: 'peripherals', name: 'Peripherals', icon: 'keyboard', description: 'Keyboards, mice, monitors and headsets for long coding sessions.' },
  { key: 'laptop-accessories', name: 'Laptop Accessories', icon: 'plug', description: 'Stands, hubs, chargers and sleeves.' },
  { key: 'storage-cables', name: 'Storage & Cables', icon: 'hard-drive', description: 'SSDs, USB drives and the cables you always need.' },
  { key: 'cs-textbooks', name: 'CS Textbooks', icon: 'book-open', description: 'The standard references for your degree and placements.' },
  { key: 'software-licenses', name: 'Software & Cloud', icon: 'key-round', description: 'Developer tools, licenses and cloud credits.' },
  { key: 'stationery', name: 'Stationery', icon: 'pen-line', description: 'Notebooks, pens and calculators for class and exams.' },
  { key: 'backpacks', name: 'Backpacks', icon: 'backpack', description: 'Bags built to carry a laptop across campus.' },
  { key: 'college-merch', name: 'College Merch', icon: 'shirt', description: 'Hoodies, tees and stickers for people who ship code.' },
  { key: 'daily-essentials', name: 'Daily Essentials', icon: 'coffee', description: 'Everyday hostel and desk gear.' },
];

export const products = [
  // ---------- Dev Hardware ----------
  {
    category: 'dev-hardware', art: 'board', name: 'Raspberry Pi 5 (8 GB)', brand: 'Raspberry Pi', price: 7999, mrp: 8999, stock: 24, featured: true, semesters: [3, 5, 7], tags: ['iot', 'sbc', 'linux'],
    description: 'A full Linux computer the size of a card. Run servers, learn networking or build the brain of your final-year project.',
    highlights: ['Quad-core Arm Cortex-A76 at 2.4 GHz', 'Runs a full Linux desktop', 'Dual 4K display output'],
    specs: [['Processor', 'CPU', 'Quad-core Cortex-A76, 2.4 GHz'], ['Processor', 'RAM', '8 GB LPDDR4X'], ['Connectivity', 'Wi-Fi', 'Dual-band 802.11ac'], ['Connectivity', 'Ports', '2 USB 3.0, 2 USB 2.0, Gigabit Ethernet'], ['I/O', 'GPIO', '40-pin header']],
  },
  {
    category: 'dev-hardware', art: 'board', name: 'Arduino Uno R3', brand: 'Arduino', price: 899, mrp: 1250, stock: 60, featured: true, semesters: [1, 3], tags: ['iot', 'microcontroller', 'embedded'],
    description: 'The board most embedded courses start with. Simple to program, hard to break, and supported by every tutorial you will find.',
    highlights: ['ATmega328P microcontroller', '14 digital and 6 analog pins', 'Programs over USB'],
    specs: [['Processor', 'Microcontroller', 'ATmega328P'], ['Processor', 'Clock', '16 MHz'], ['Memory', 'Flash', '32 KB'], ['I/O', 'Digital pins', '14'], ['I/O', 'Analog pins', '6']],
  },
  {
    category: 'dev-hardware', art: 'chip', name: 'ESP32 Dev Board', brand: 'Espressif', price: 449, mrp: 699, stock: 85, semesters: [3, 5], tags: ['iot', 'wifi', 'bluetooth', 'microcontroller'],
    description: 'Wi-Fi and Bluetooth on one cheap board. A good pick when your IoT project needs to talk to the internet.',
    highlights: ['Built-in Wi-Fi and Bluetooth', 'Dual-core processor', 'Works with the Arduino IDE'],
    specs: [['Processor', 'CPU', 'Dual-core Xtensa LX6, 240 MHz'], ['Memory', 'Flash', '4 MB'], ['Connectivity', 'Wi-Fi', '802.11 b/g/n'], ['Connectivity', 'Bluetooth', 'BLE 4.2'], ['I/O', 'GPIO', '30 pins']],
  },
  {
    category: 'dev-hardware', art: 'sensor', name: 'IoT Sensor Pack (37 in 1)', brand: 'Robocraze', price: 1299, mrp: 1799, stock: 32, semesters: [3, 5], tags: ['iot', 'sensors', 'lab'],
    description: 'Temperature, motion, sound, light and more in one labelled box. Enough to cover most lab assignments.',
    highlights: ['37 common sensor modules', 'Labelled storage box', 'Works with Arduino and ESP32'],
    specs: [['Contents', 'Modules', '37'], ['Contents', 'Includes', 'DHT11, ultrasonic, IR, relay, joystick'], ['Compatibility', 'Boards', 'Arduino, ESP32, Raspberry Pi']],
  },
  {
    category: 'dev-hardware', art: 'board', name: 'Breadboard & Jumper Wire Set', brand: 'Robocraze', price: 249, mrp: 399, stock: 120, semesters: [1, 3], tags: ['iot', 'lab', 'prototyping'],
    description: 'An 830-point breadboard and 120 jumper wires. You will use these in every hardware lab.',
    highlights: ['830 tie points', '120 jumper wires', 'No soldering needed'],
    specs: [['Contents', 'Breadboard', '830 points'], ['Contents', 'Jumper wires', '40 M-M, 40 M-F, 40 F-F']],
  },
  {
    category: 'dev-hardware', art: 'tool', name: 'Digital Multimeter DT-830D', brand: 'Mextech', price: 399, mrp: 599, stock: 4, threshold: 5, semesters: [1, 3], tags: ['lab', 'tools', 'electronics'],
    description: 'Measures voltage, current and resistance. A basic tool for checking why your circuit is not working.',
    highlights: ['Voltage, current and resistance', 'Continuity buzzer', 'Pocket size'],
    specs: [['Measurement', 'DC voltage', 'Up to 1000 V'], ['Measurement', 'AC voltage', 'Up to 750 V'], ['Measurement', 'Resistance', 'Up to 2 MΩ']],
  },
  {
    category: 'dev-hardware', art: 'board', name: 'NVIDIA Jetson Nano Developer Kit', brand: 'NVIDIA', price: 12499, mrp: 14999, stock: 0, semesters: [5, 7], tags: ['ai', 'ml', 'gpu', 'sbc'],
    description: 'A small GPU computer for running vision and machine learning models on-device.',
    highlights: ['128-core NVIDIA GPU', 'Runs TensorFlow and PyTorch', 'CSI camera connector'],
    specs: [['Processor', 'CPU', 'Quad-core Cortex-A57'], ['Processor', 'GPU', '128-core Maxwell'], ['Processor', 'RAM', '4 GB LPDDR4'], ['Connectivity', 'Ports', '4 USB 3.0, Gigabit Ethernet, HDMI']],
  },

  // ---------- Laptops ----------
  {
    category: 'laptops', art: 'laptop', name: 'Lenovo IdeaPad Slim 5 (Ryzen 7)', brand: 'Lenovo', price: 64990, mrp: 82390, stock: 12, slot: 'laptop', featured: true, semesters: [1, 3, 5, 7], tags: ['laptop', 'coding', 'ryzen'],
    description: 'A light all-rounder with enough cores and memory for IDEs, Docker and a browser full of tabs.',
    highlights: ['16 GB RAM handles Docker comfortably', 'Backlit keyboard', 'Over 10 hours of battery'],
    specs: [['Processor', 'CPU', 'AMD Ryzen 7 7730U'], ['Memory', 'RAM', '16 GB DDR4'], ['Storage', 'SSD', '512 GB NVMe'], ['Display', 'Screen', '14-inch 1920×1200 IPS'], ['Body', 'Weight', '1.46 kg']],
  },
  {
    category: 'laptops', art: 'laptop', name: 'HP Victus 15 Gaming (RTX 3050)', brand: 'HP', price: 72990, mrp: 89990, stock: 7, slot: 'laptop', semesters: [5, 7], tags: ['laptop', 'gpu', 'ml', 'gaming'],
    description: 'A dedicated GPU for training small models locally, and for gaming after submissions are in.',
    highlights: ['NVIDIA RTX 3050 with CUDA support', '144 Hz display', 'Upgradable RAM'],
    specs: [['Processor', 'CPU', 'Intel Core i5-12450H'], ['Processor', 'GPU', 'NVIDIA RTX 3050, 4 GB'], ['Memory', 'RAM', '16 GB DDR4'], ['Storage', 'SSD', '512 GB NVMe'], ['Display', 'Screen', '15.6-inch FHD 144 Hz'], ['Body', 'Weight', '2.29 kg']],
  },
  {
    category: 'laptops', art: 'laptop', name: 'MacBook Air 13 (M3)', brand: 'Apple', price: 104900, mrp: 114900, stock: 3, threshold: 5, slot: 'laptop', semesters: [1, 3, 5, 7], tags: ['laptop', 'macos', 'unix'],
    description: 'Silent, very long battery life, and a Unix terminal out of the box. Good for development that does not need x86.',
    highlights: ['Fanless design', 'Up to 18 hours of battery', 'Unix-based macOS'],
    specs: [['Processor', 'CPU', 'Apple M3, 8-core'], ['Memory', 'RAM', '16 GB unified'], ['Storage', 'SSD', '256 GB'], ['Display', 'Screen', '13.6-inch Liquid Retina'], ['Body', 'Weight', '1.24 kg']],
  },
  {
    category: 'laptops', art: 'laptop', name: 'Acer Aspire 5 (Core i5)', brand: 'Acer', price: 48990, mrp: 62999, stock: 18, slot: 'laptop', semesters: [1, 3], tags: ['laptop', 'budget', 'coding'],
    description: 'The budget choice that still runs VS Code, compilers and light virtual machines without trouble.',
    highlights: ['Best price in this range', 'Extra M.2 slot for storage', 'Full-size keyboard'],
    specs: [['Processor', 'CPU', 'Intel Core i5-1235U'], ['Memory', 'RAM', '8 GB DDR4'], ['Storage', 'SSD', '512 GB NVMe'], ['Display', 'Screen', '15.6-inch FHD'], ['Body', 'Weight', '1.59 kg']],
  },

  // ---------- Peripherals ----------
  {
    category: 'peripherals', art: 'keyboard', name: 'Keychron K2 Mechanical Keyboard', brand: 'Keychron', price: 7499, mrp: 8999, stock: 16, slot: 'keyboard', featured: true, tags: ['keyboard', 'mechanical', 'wireless'],
    description: 'A compact wireless mechanical keyboard that pairs with three devices and works on Windows, macOS and Linux.',
    highlights: ['Hot-swappable switches', 'Connects to three devices', 'Compact 75% layout'],
    specs: [['Keyboard', 'Layout', '75%, 84 keys'], ['Keyboard', 'Switches', 'Gateron Brown'], ['Connectivity', 'Wireless', 'Bluetooth 5.1'], ['Connectivity', 'Wired', 'USB-C'], ['Power', 'Battery', '4000 mAh']],
  },
  {
    category: 'peripherals', art: 'keyboard', name: 'TVS Gold Bharat Mechanical Keyboard', brand: 'TVS', price: 3299, mrp: 3999, stock: 22, slot: 'keyboard', tags: ['keyboard', 'mechanical', 'wired'],
    description: 'A sturdy full-size mechanical keyboard with a strong typing feel at a student price.',
    highlights: ['Full-size layout', 'Mechanical switches', 'Includes a rupee key'],
    specs: [['Keyboard', 'Layout', 'Full size, 104 keys'], ['Keyboard', 'Switches', 'TVS Mechanical'], ['Connectivity', 'Wired', 'USB-A']],
  },
  {
    category: 'peripherals', art: 'keyboard', name: 'Logitech K380 Wireless Keyboard', brand: 'Logitech', price: 2495, mrp: 3195, stock: 30, slot: 'keyboard', tags: ['keyboard', 'wireless', 'portable'],
    description: 'A quiet, slim keyboard that fits in a backpack and is easy on shared hostel rooms.',
    highlights: ['Very quiet typing', 'Two-year battery life', 'Fits in a bag'],
    specs: [['Keyboard', 'Layout', 'Compact, 79 keys'], ['Connectivity', 'Wireless', 'Bluetooth'], ['Power', 'Battery', '2 AAA']],
  },
  {
    category: 'peripherals', art: 'mouse', name: 'Logitech MX Master 3S', brand: 'Logitech', price: 8995, mrp: 10995, stock: 11, slot: 'mouse', featured: true, tags: ['mouse', 'wireless', 'ergonomic'],
    description: 'A comfortable mouse with a fast scroll wheel that gets through long log files in one flick.',
    highlights: ['8000 DPI sensor works on glass', 'Very quiet clicks', 'Connects to three devices'],
    specs: [['Sensor', 'DPI', '8000'], ['Sensor', 'Tracks on', 'Any surface, including glass'], ['Connectivity', 'Wireless', 'Bluetooth, Logi Bolt'], ['Power', 'Battery', 'Up to 70 days']],
  },
  {
    category: 'peripherals', art: 'mouse', name: 'Logitech M331 Silent Mouse', brand: 'Logitech', price: 899, mrp: 1295, stock: 70, slot: 'mouse', tags: ['mouse', 'wireless', 'budget', 'silent'],
    description: 'A cheap, reliable wireless mouse with quiet clicks, so nobody in the library looks up.',
    highlights: ['Very quiet clicks', '24-month battery', 'USB receiver included'],
    specs: [['Sensor', 'DPI', '1000'], ['Connectivity', 'Wireless', '2.4 GHz USB'], ['Power', 'Battery', '1 AA, up to 24 months']],
  },
  {
    category: 'peripherals', art: 'monitor', name: 'LG 24 Inch IPS Monitor', brand: 'LG', price: 9499, mrp: 13500, stock: 14, slot: 'monitor', featured: true, tags: ['monitor', 'ips', 'display'],
    description: 'A second screen means less alt-tabbing between docs and code. This one has accurate colours and thin bezels.',
    highlights: ['Full HD IPS panel', '75 Hz refresh rate', 'Thin bezels for dual setups'],
    specs: [['Display', 'Size', '24 inch'], ['Display', 'Resolution', '1920×1080'], ['Display', 'Panel', 'IPS, 75 Hz'], ['Connectivity', 'Ports', 'HDMI, VGA']],
  },
  {
    category: 'peripherals', art: 'monitor', name: 'Dell S2722QC 27 Inch 4K Monitor', brand: 'Dell', price: 28999, mrp: 37999, stock: 5, threshold: 5, slot: 'monitor', tags: ['monitor', '4k', 'usb-c'],
    description: 'Sharp text and one USB-C cable that powers your laptop and carries the display.',
    highlights: ['4K resolution', '65 W USB-C charging', 'Height-adjustable stand'],
    specs: [['Display', 'Size', '27 inch'], ['Display', 'Resolution', '3840×2160'], ['Display', 'Panel', 'IPS, 60 Hz'], ['Connectivity', 'Ports', 'USB-C 65 W, 2 HDMI, USB hub']],
  },
  {
    category: 'peripherals', art: 'headset', name: 'Sony WH-CH720N Headphones', brand: 'Sony', price: 8990, mrp: 14990, stock: 19, slot: 'headset', featured: true, tags: ['audio', 'headphones', 'anc', 'wireless'],
    description: 'Noise cancelling that shuts out a loud hostel corridor, at a light 192 grams.',
    highlights: ['Active noise cancelling', 'Up to 50 hours of battery', 'Weighs only 192 g'],
    specs: [['Audio', 'Noise cancelling', 'Active'], ['Audio', 'Driver', '30 mm'], ['Connectivity', 'Wireless', 'Bluetooth 5.2'], ['Power', 'Battery', 'Up to 50 hours']],
  },
  {
    category: 'peripherals', art: 'headset', name: 'boAt Rockerz 450 Headphones', brand: 'boAt', price: 1299, mrp: 3990, stock: 55, slot: 'headset', tags: ['audio', 'headphones', 'budget', 'wireless'],
    description: 'Budget wireless headphones for lecture recordings, music and online contests.',
    highlights: ['15 hours of battery', 'Padded ear cups', 'Works wired too'],
    specs: [['Audio', 'Driver', '40 mm'], ['Connectivity', 'Wireless', 'Bluetooth 5.0'], ['Power', 'Battery', 'Up to 15 hours']],
  },

  // ---------- Laptop Accessories ----------
  {
    category: 'laptop-accessories', art: 'stand', name: 'Aluminium Laptop Stand', brand: 'Portronics', price: 1199, mrp: 1999, stock: 40, tags: ['stand', 'ergonomic', 'desk'],
    description: 'Raises your screen to eye level. Your neck will notice the difference by the end of the semester.',
    highlights: ['Six height settings', 'Folds flat', 'Holds laptops up to 17 inches'],
    specs: [['Build', 'Material', 'Aluminium alloy'], ['Build', 'Fits', '10 to 17 inch laptops'], ['Build', 'Weight', '280 g']],
  },
  {
    category: 'laptop-accessories', art: 'hub', name: '7-in-1 USB-C Hub', brand: 'Anker', price: 2999, mrp: 4499, stock: 26, featured: true, tags: ['usb-c', 'hub', 'hdmi'],
    description: 'Adds the ports thin laptops leave out: HDMI, USB-A and an SD card reader through one USB-C port.',
    highlights: ['4K HDMI output', '100 W power pass-through', 'SD and microSD readers'],
    specs: [['Ports', 'Video', 'HDMI 4K at 30 Hz'], ['Ports', 'USB', '2 USB-A 3.0, 1 USB-C data'], ['Ports', 'Cards', 'SD, microSD'], ['Power', 'Pass-through', '100 W']],
  },
  {
    category: 'laptop-accessories', art: 'charger', name: '65 W GaN USB-C Charger', brand: 'Anker', price: 2799, mrp: 3999, stock: 21, tags: ['charger', 'usb-c', 'gan'],
    description: 'A small charger for your laptop and phone, so you carry one brick instead of two.',
    highlights: ['Charges most USB-C laptops', 'Two USB-C ports', 'Much smaller than stock chargers'],
    specs: [['Power', 'Output', '65 W'], ['Ports', 'USB-C', '2'], ['Ports', 'USB-A', '1']],
  },
  {
    category: 'laptop-accessories', art: 'sleeve', name: '15.6 Inch Padded Laptop Sleeve', brand: 'AmazonBasics', price: 599, mrp: 999, stock: 48, tags: ['sleeve', 'protection'],
    description: 'A soft padded sleeve that stops scratches when your laptop shares a bag with chargers and notebooks.',
    highlights: ['Padded on all sides', 'Front pocket for a charger', 'Water-resistant outer'],
    specs: [['Build', 'Fits', 'Up to 15.6 inch'], ['Build', 'Material', 'Neoprene']],
  },
  {
    category: 'laptop-accessories', art: 'webcam', name: 'Logitech C270 HD Webcam', brand: 'Logitech', price: 1795, mrp: 2595, stock: 2, threshold: 5, tags: ['webcam', 'video', 'interviews'],
    description: 'A sharper picture than a built-in laptop camera, for online interviews and viva sessions.',
    highlights: ['720p video', 'Built-in microphone', 'Plug and play'],
    specs: [['Video', 'Resolution', '720p, 30 fps'], ['Audio', 'Microphone', 'Built-in, noise reducing'], ['Connectivity', 'Wired', 'USB-A']],
  },

  // ---------- Storage & Cables ----------
  {
    category: 'storage-cables', art: 'ssd', name: 'Samsung T7 Portable SSD (1 TB)', brand: 'Samsung', price: 8499, mrp: 11999, stock: 17, slot: 'storage', featured: true, tags: ['ssd', 'storage', 'usb-c', 'portable'],
    description: 'Fast external storage for datasets, VM images and project backups.',
    highlights: ['Up to 1050 MB/s', 'Pocket size', 'Hardware encryption'],
    specs: [['Storage', 'Capacity', '1 TB'], ['Storage', 'Read speed', 'Up to 1050 MB/s'], ['Connectivity', 'Port', 'USB-C 3.2 Gen 2'], ['Body', 'Weight', '58 g']],
  },
  {
    category: 'storage-cables', art: 'ssd', name: 'WD Elements Hard Drive (2 TB)', brand: 'Western Digital', price: 5999, mrp: 7499, stock: 23, slot: 'storage', tags: ['hdd', 'storage', 'backup'],
    description: 'A lot of storage for little money. Good for backups and media that do not need SSD speed.',
    highlights: ['2 TB of space', 'USB-powered', 'Good for backups'],
    specs: [['Storage', 'Capacity', '2 TB'], ['Storage', 'Type', '2.5-inch HDD'], ['Connectivity', 'Port', 'USB 3.0']],
  },
  {
    category: 'storage-cables', art: 'usb', name: 'SanDisk Ultra USB 3.0 Drive (64 GB)', brand: 'SanDisk', price: 549, mrp: 899, stock: 150, slot: 'storage', tags: ['usb', 'pendrive', 'storage'],
    description: 'For lab submissions and bootable Linux installers. You will always need one more of these.',
    highlights: ['USB 3.0 speeds', 'Password protection software', 'Sliding connector'],
    specs: [['Storage', 'Capacity', '64 GB'], ['Storage', 'Read speed', 'Up to 130 MB/s'], ['Connectivity', 'Port', 'USB-A 3.0']],
  },
  {
    category: 'storage-cables', art: 'cable', name: 'Braided USB-C to USB-C Cable (2 m)', brand: 'Anker', price: 799, mrp: 1299, stock: 95, tags: ['cable', 'usb-c', 'charging'],
    description: 'A long, tough charging cable that reaches from the one hostel socket to your bed.',
    highlights: ['100 W charging', 'Braided nylon', '2 metres long'],
    specs: [['Cable', 'Length', '2 m'], ['Cable', 'Power', '100 W'], ['Cable', 'Data', 'USB 2.0, 480 Mbps']],
  },
  {
    category: 'storage-cables', art: 'cable', name: 'Cat 6 Ethernet Cable (3 m)', brand: 'D-Link', price: 299, mrp: 499, stock: 80, semesters: [5], tags: ['cable', 'ethernet', 'networking', 'lab'],
    description: 'For when hostel Wi-Fi fails during a contest. Also useful for your networks lab.',
    highlights: ['Gigabit speeds', 'Snagless connectors', '3 metres long'],
    specs: [['Cable', 'Length', '3 m'], ['Cable', 'Category', 'Cat 6'], ['Cable', 'Speed', 'Up to 1 Gbps']],
  },
  {
    category: 'storage-cables', art: 'cable', name: 'HDMI 2.0 Cable (1.5 m)', brand: 'AmazonBasics', price: 349, mrp: 599, stock: 65, tags: ['cable', 'hdmi', 'display'],
    description: 'Connects your laptop to a monitor or a classroom projector at 4K.',
    highlights: ['4K at 60 Hz', 'Gold-plated connectors', '1.5 metres long'],
    specs: [['Cable', 'Length', '1.5 m'], ['Cable', 'Standard', 'HDMI 2.0'], ['Cable', 'Resolution', '4K at 60 Hz']],
  },

  // ---------- CS Textbooks ----------
  {
    category: 'cs-textbooks', art: 'book', name: 'Introduction to Algorithms (CLRS)', brand: 'MIT Press', price: 1099, mrp: 1495, stock: 45, featured: true, semesters: [3, 4], tags: ['algorithms', 'dsa', 'textbook', 'placements'], cover: ['Introduction to', 'Algorithms'], author: 'Cormen et al.',
    description: 'The standard algorithms reference, used in universities worldwide and useful long after graduation.',
    highlights: ['Covers sorting, graphs and dynamic programming', 'Fourth edition', 'A reference for placements'],
    specs: [['Book', 'Authors', 'Cormen, Leiserson, Rivest, Stein'], ['Book', 'Edition', '4th'], ['Book', 'Pages', '1312'], ['Book', 'Language', 'English']],
  },
  {
    category: 'cs-textbooks', art: 'book', name: 'Operating System Concepts (Galvin)', brand: 'Wiley', price: 899, mrp: 1199, stock: 38, semesters: [4, 5], tags: ['os', 'textbook'], cover: ['Operating System', 'Concepts'], author: 'Silberschatz, Galvin',
    description: 'The dinosaur book. Clear explanations of processes, memory and file systems for your OS course.',
    highlights: ['Covers processes, threads and memory', 'Linux and Windows examples', 'Tenth edition'],
    specs: [['Book', 'Authors', 'Silberschatz, Galvin, Gagne'], ['Book', 'Edition', '10th'], ['Book', 'Pages', '1040'], ['Book', 'Language', 'English']],
  },
  {
    category: 'cs-textbooks', art: 'book', name: 'Database System Concepts (Korth)', brand: 'McGraw Hill', price: 949, mrp: 1250, stock: 29, semesters: [4, 5], tags: ['dbms', 'sql', 'textbook'], cover: ['Database System', 'Concepts'], author: 'Silberschatz, Korth',
    description: 'From ER diagrams to transactions, the book most DBMS courses are built around.',
    highlights: ['ER models, SQL and normalization', 'Transactions and indexing', 'Seventh edition'],
    specs: [['Book', 'Authors', 'Silberschatz, Korth, Sudarshan'], ['Book', 'Edition', '7th'], ['Book', 'Pages', '1376'], ['Book', 'Language', 'English']],
  },
  {
    category: 'cs-textbooks', art: 'book', name: 'Computer Networking: A Top-Down Approach', brand: 'Pearson', price: 829, mrp: 1099, stock: 33, semesters: [5], tags: ['networks', 'textbook'], cover: ['Computer', 'Networking'], author: 'Kurose, Ross',
    description: 'Starts at the application layer and works down, so networking makes sense from the first chapter.',
    highlights: ['Starts with HTTP and works down', 'Includes Wireshark labs', 'Eighth edition'],
    specs: [['Book', 'Authors', 'Kurose, Ross'], ['Book', 'Edition', '8th'], ['Book', 'Pages', '800'], ['Book', 'Language', 'English']],
  },
  {
    category: 'cs-textbooks', art: 'book', name: 'Clean Code', brand: 'Pearson', price: 649, mrp: 899, stock: 52, featured: true, semesters: [3, 5, 7], tags: ['software-engineering', 'best-practices'], cover: ['Clean', 'Code'], author: 'Robert C. Martin',
    description: 'Practical habits for writing code your teammates can read, with plenty of worked examples.',
    highlights: ['Naming, functions and refactoring', 'Lots of before-and-after code', 'Common internship recommendation'],
    specs: [['Book', 'Author', 'Robert C. Martin'], ['Book', 'Edition', '1st'], ['Book', 'Pages', '464'], ['Book', 'Language', 'English']],
  },
  {
    category: 'cs-textbooks', art: 'book', name: 'Cracking the Coding Interview', brand: 'CareerCup', price: 799, mrp: 1099, stock: 3, threshold: 5, semesters: [5, 6, 7, 8], tags: ['placements', 'interviews', 'dsa'], cover: ['Cracking the', 'Coding Interview'], author: 'Gayle L. McDowell',
    description: 'A widely used interview prep book, with 189 questions and clear ways of thinking through them.',
    highlights: ['189 programming questions', 'Solutions with explanations', 'Advice on the interview process'],
    specs: [['Book', 'Author', 'Gayle Laakmann McDowell'], ['Book', 'Edition', '6th'], ['Book', 'Pages', '708'], ['Book', 'Language', 'English']],
  },
  {
    category: 'cs-textbooks', art: 'book', name: 'Compilers: Principles, Techniques and Tools', brand: 'Pearson', price: 899, mrp: 1199, stock: 21, semesters: [6], tags: ['compilers', 'textbook'], cover: ['Compilers'], author: 'Aho, Lam, Sethi, Ullman',
    description: 'The Dragon Book. A thorough walk through lexing, parsing, optimization and code generation.',
    highlights: ['Lexing, parsing and code generation', 'Classic course reference', 'Second edition'],
    specs: [['Book', 'Authors', 'Aho, Lam, Sethi, Ullman'], ['Book', 'Edition', '2nd'], ['Book', 'Pages', '1040'], ['Book', 'Language', 'English']],
  },
  {
    category: 'cs-textbooks', art: 'book', name: 'Hands-On Machine Learning', brand: "O'Reilly", price: 1399, mrp: 1850, stock: 26, semesters: [5, 6, 7], tags: ['ml', 'ai', 'python'], cover: ['Hands-On', 'Machine Learning'], author: 'Aurélien Géron',
    description: 'Learn machine learning by building models with Scikit-Learn, Keras and TensorFlow.',
    highlights: ['Project-based chapters', 'Scikit-Learn, Keras and TensorFlow', 'Code notebooks available'],
    specs: [['Book', 'Author', 'Aurélien Géron'], ['Book', 'Edition', '3rd'], ['Book', 'Pages', '861'], ['Book', 'Language', 'English']],
  },

  // ---------- Software & Cloud ----------
  {
    category: 'software-licenses', art: 'key', name: 'JetBrains All Products Pack (1 Year)', brand: 'JetBrains', price: 6999, mrp: 8999, stock: 200, tags: ['ide', 'license', 'intellij'],
    description: 'IntelliJ IDEA, PyCharm, WebStorm and the rest of the JetBrains IDEs under one license key.',
    highlights: ['Every JetBrains IDE', 'One-year license', 'Delivered as a key'],
    specs: [['License', 'Duration', '1 year'], ['License', 'Devices', 'Personal use, any machine'], ['License', 'Delivery', 'Digital key']],
  },
  {
    category: 'software-licenses', art: 'cloud', name: 'Cloud Credits for Students (₹2,000)', brand: 'CampusCloud', price: 1499, mrp: 2000, stock: 150, semesters: [5, 6, 7, 8], tags: ['cloud', 'hosting', 'deployment'],
    description: 'Credits to host your final-year project or test a deployment without a surprise bill.',
    highlights: ['₹2,000 of credit', 'Valid for 12 months', 'Works for servers and databases'],
    specs: [['Credit', 'Value', '₹2,000'], ['Credit', 'Validity', '12 months'], ['Credit', 'Delivery', 'Digital key']],
  },
  {
    category: 'software-licenses', art: 'key', name: 'Microsoft 365 Personal (1 Year)', brand: 'Microsoft', price: 3999, mrp: 6199, stock: 90, tags: ['office', 'license', 'productivity'],
    description: 'Word, Excel and PowerPoint for reports and presentations, with 1 TB of OneDrive storage.',
    highlights: ['Full Office apps', '1 TB of cloud storage', 'One-year license'],
    specs: [['License', 'Duration', '1 year'], ['License', 'Users', '1'], ['License', 'Storage', '1 TB OneDrive']],
  },
  {
    category: 'software-licenses', art: 'key', name: 'Domain Name + Hosting Starter Pack', brand: 'CampusCloud', price: 899, mrp: 1499, stock: 110, semesters: [3, 5, 7], tags: ['domain', 'hosting', 'portfolio'],
    description: 'A .dev domain and a year of basic hosting. Just enough to put your portfolio online.',
    highlights: ['One .dev domain', 'One year of hosting', 'Free SSL certificate'],
    specs: [['Plan', 'Domain', '1 .dev name'], ['Plan', 'Hosting', '10 GB, 1 year'], ['Plan', 'SSL', 'Included']],
  },

  // ---------- Stationery ----------
  {
    category: 'stationery', art: 'notebook', name: 'Classmate Notebook Pack (6 Pack)', brand: 'Classmate', price: 349, mrp: 450, stock: 140, semesters: [1, 2, 3, 4, 5, 6, 7, 8], tags: ['notebook', 'stationery'],
    description: 'Six ruled notebooks, one for each subject, with paper that takes ink without bleeding through.',
    highlights: ['Six 172-page notebooks', 'Single-line ruling', 'Smooth paper'],
    specs: [['Notebook', 'Pages', '172 each'], ['Notebook', 'Ruling', 'Single line'], ['Notebook', 'Size', '24 × 18 cm']],
  },
  {
    category: 'stationery', art: 'notebook', name: 'Dot Grid Engineering Notebook', brand: 'Paperkraft', price: 299, mrp: 399, stock: 85, tags: ['notebook', 'dot-grid', 'stationery'],
    description: 'Dot grid pages for sketching system designs, flowcharts and ER diagrams.',
    highlights: ['Dot grid on every page', 'Lays flat when open', 'Elastic closure'],
    specs: [['Notebook', 'Pages', '192'], ['Notebook', 'Ruling', 'Dot grid'], ['Notebook', 'Size', 'A5']],
  },
  {
    category: 'stationery', art: 'pen', name: 'Gel Pen Set (10 Pack)', brand: 'Pilot', price: 249, mrp: 320, stock: 200, tags: ['pen', 'stationery', 'exams'],
    description: 'Smooth pens that keep up through a three-hour exam.',
    highlights: ['Ten pens', 'Fast-drying ink', 'Comfortable grip'],
    specs: [['Pen', 'Tip', '0.5 mm'], ['Pen', 'Colours', '6 blue, 2 black, 2 red']],
  },
  {
    category: 'stationery', art: 'calculator', name: 'Casio FX-991ES Plus Calculator', brand: 'Casio', price: 1045, mrp: 1295, stock: 42, semesters: [1, 2, 3, 4], tags: ['calculator', 'exams', 'maths'],
    description: 'The scientific calculator accepted in most university exams, with matrix and statistics modes.',
    highlights: ['417 functions', 'Matrix and vector calculations', 'Solar and battery powered'],
    specs: [['Calculator', 'Functions', '417'], ['Calculator', 'Display', 'Natural textbook display'], ['Power', 'Source', 'Solar and LR44 battery']],
  },
  {
    category: 'stationery', art: 'sticky', name: 'Whiteboard and Marker Set', brand: 'Camlin', price: 699, mrp: 999, stock: 0, tags: ['whiteboard', 'desk', 'stationery'],
    description: 'Practise whiteboard interviews and work through dry runs in your room.',
    highlights: ['60 × 45 cm board', 'Four markers and a duster', 'Wall-mountable'],
    specs: [['Board', 'Size', '60 × 45 cm'], ['Board', 'Includes', '4 markers, duster']],
  },

  // ---------- Backpacks ----------
  {
    category: 'backpacks', art: 'backpack', name: 'Wildcraft Evo 35 L Backpack', brand: 'Wildcraft', price: 1899, mrp: 2999, stock: 34, slot: 'bag', featured: true, tags: ['backpack', 'bag', 'laptop'],
    description: 'Room for a laptop, books and a change of clothes, with padded straps for the walk across campus.',
    highlights: ['Padded 15.6-inch laptop section', '35 litres', 'Rain cover included'],
    specs: [['Bag', 'Capacity', '35 L'], ['Bag', 'Laptop fit', 'Up to 15.6 inch'], ['Bag', 'Material', 'Polyester']],
  },
  {
    category: 'backpacks', art: 'backpack', name: 'American Tourister Urban Backpack', brand: 'American Tourister', price: 1499, mrp: 2750, stock: 28, slot: 'bag', tags: ['backpack', 'bag', 'laptop'],
    description: 'A slim, everyday bag with enough organization for a laptop, charger and notebook.',
    highlights: ['Padded laptop section', 'Water-resistant fabric', 'USB charging port'],
    specs: [['Bag', 'Capacity', '28 L'], ['Bag', 'Laptop fit', 'Up to 15 inch'], ['Bag', 'Material', 'Polyester']],
  },
  {
    category: 'backpacks', art: 'backpack', name: 'Anti-Theft Laptop Backpack', brand: 'Tarpan', price: 2299, mrp: 3499, stock: 4, threshold: 5, slot: 'bag', tags: ['backpack', 'bag', 'laptop', 'anti-theft'],
    description: 'The zips sit against your back, which helps on crowded buses and trains.',
    highlights: ['Hidden zips', 'Cut-resistant fabric', 'Fits a 17-inch laptop'],
    specs: [['Bag', 'Capacity', '30 L'], ['Bag', 'Laptop fit', 'Up to 17 inch'], ['Bag', 'Material', 'Oxford fabric']],
  },

  // ---------- College Merch ----------
  {
    category: 'college-merch', art: 'hoodie', name: 'sudo make me a sandwich Hoodie', brand: 'CampusCart', price: 1299, mrp: 1799, stock: 36, featured: true, tags: ['merch', 'hoodie', 'clothing'],
    description: 'A heavy cotton hoodie for very cold labs, with a joke other CS students will get.',
    highlights: ['320 GSM cotton blend', 'Sizes S to XXL', 'Kangaroo pocket'],
    specs: [['Clothing', 'Fabric', '320 GSM cotton blend'], ['Clothing', 'Sizes', 'S, M, L, XL, XXL'], ['Clothing', 'Fit', 'Regular']],
  },
  {
    category: 'college-merch', art: 'tshirt', name: 'It Works on My Machine T-Shirt', brand: 'CampusCart', price: 599, mrp: 899, stock: 75, tags: ['merch', 'tshirt', 'clothing'],
    description: 'A soft cotton tee for every project demo that was working five minutes ago.',
    highlights: ['100% cotton', 'Sizes S to XXL', 'Preshrunk'],
    specs: [['Clothing', 'Fabric', '180 GSM cotton'], ['Clothing', 'Sizes', 'S, M, L, XL, XXL'], ['Clothing', 'Fit', 'Regular']],
  },
  {
    category: 'college-merch', art: 'sticker', name: 'Developer Laptop Sticker Pack (50)', brand: 'CampusCart', price: 199, mrp: 299, stock: 240, tags: ['merch', 'stickers'],
    description: 'Fifty waterproof stickers of languages, frameworks and old programming jokes.',
    highlights: ['50 vinyl stickers', 'Waterproof', 'Removes without residue'],
    specs: [['Stickers', 'Count', '50'], ['Stickers', 'Material', 'Waterproof vinyl']],
  },
  {
    category: 'college-merch', art: 'mug', name: 'Null Pointer Coffee Mug', brand: 'CampusCart', price: 349, mrp: 499, stock: 58, tags: ['merch', 'mug', 'coffee'],
    description: 'A 330 ml ceramic mug for the third coffee of the night before a submission.',
    highlights: ['330 ml', 'Ceramic', 'Dishwasher safe'],
    specs: [['Mug', 'Capacity', '330 ml'], ['Mug', 'Material', 'Ceramic']],
  },

  // ---------- Daily Essentials ----------
  {
    category: 'daily-essentials', art: 'bottle', name: 'Insulated Steel Bottle (1 L)', brand: 'Milton', price: 799, mrp: 1150, stock: 66, tags: ['bottle', 'hostel', 'essentials'],
    description: 'Keeps water cold through a full day of labs, and it survives being dropped.',
    highlights: ['Cold for 24 hours', 'Leak-proof lid', 'Stainless steel'],
    specs: [['Bottle', 'Capacity', '1 L'], ['Bottle', 'Material', 'Stainless steel'], ['Bottle', 'Insulation', 'Double wall']],
  },
  {
    category: 'daily-essentials', art: 'lamp', name: 'LED Study Lamp with USB Port', brand: 'Philips', price: 1199, mrp: 1799, stock: 31, tags: ['lamp', 'hostel', 'desk'],
    description: 'Adjustable light for late-night study, with a USB port to charge your phone.',
    highlights: ['Three brightness levels', 'Flexible neck', 'USB charging port'],
    specs: [['Lamp', 'Power', '6 W LED'], ['Lamp', 'Levels', '3'], ['Lamp', 'Extra', 'USB charging port']],
  },
  {
    category: 'daily-essentials', art: 'powerbank', name: '20000 mAh Power Bank', brand: 'Mi', price: 1999, mrp: 2999, stock: 44, featured: true, tags: ['powerbank', 'charging', 'essentials'],
    description: 'Enough to charge a phone four times, which is useful during hostel power cuts.',
    highlights: ['20000 mAh', '22.5 W fast charging', 'Two outputs'],
    specs: [['Power', 'Capacity', '20000 mAh'], ['Power', 'Output', '22.5 W'], ['Ports', 'Outputs', '2 USB-A, 1 USB-C']],
  },
  {
    category: 'daily-essentials', art: 'plug', name: 'Surge Protector Extension (4 Socket)', brand: 'Belkin', price: 899, mrp: 1399, stock: 39, tags: ['extension', 'hostel', 'power'],
    description: 'Hostel rooms never have enough sockets. This adds four, with surge protection for your laptop.',
    highlights: ['Four sockets', 'Surge protection', '2 metre cord'],
    specs: [['Power', 'Sockets', '4'], ['Power', 'Protection', 'Surge, 525 J'], ['Power', 'Cord', '2 m']],
  },
];

export const kits = [
  {
    name: 'IoT Starter Kit', art: 'chip', audience: 'Beginners in embedded systems', semester: 3, featured: true,
    description: 'Everything for your first connected project: a board with Wi-Fi, sensors, a breadboard and a multimeter for when it does not work.',
    items: [['Arduino Uno R3', 1], ['ESP32 Dev Board', 1], ['IoT Sensor Pack (37 in 1)', 1], ['Breadboard & Jumper Wire Set', 1], ['Digital Multimeter DT-830D', 1]],
  },
  {
    name: 'Semester 3 DSA Kit', art: 'book', audience: 'Second-year CSE students', semester: 3, featured: true,
    description: 'The standard algorithms reference, dot grid notebooks for dry runs and pens for working through problems by hand.',
    items: [['Introduction to Algorithms (CLRS)', 1], ['Dot Grid Engineering Notebook', 2], ['Gel Pen Set (10 Pack)', 1]],
  },
  {
    name: 'Semester 5 CSE Kit', art: 'book', audience: 'Third-year CSE students', semester: 5, featured: true,
    description: 'The three core subject textbooks for the semester, plus notebooks for all of them.',
    items: [['Operating System Concepts (Galvin)', 1], ['Database System Concepts (Korth)', 1], ['Computer Networking: A Top-Down Approach', 1], ['Classmate Notebook Pack (6 Pack)', 1]],
  },
  {
    name: 'Hackathon Survival Kit', art: 'powerbank', audience: 'Anyone with a 36-hour deadline', semester: null, featured: true,
    description: 'Stay charged and connected through the night: a power bank, a long cable, a USB-C hub and a mug for the coffee.',
    items: [['20000 mAh Power Bank', 1], ['Braided USB-C to USB-C Cable (2 m)', 1], ['7-in-1 USB-C Hub', 1], ['Null Pointer Coffee Mug', 1], ['Developer Laptop Sticker Pack (50)', 1]],
  },
  {
    name: 'First-Year Starter Kit', art: 'backpack', audience: 'New students', semester: 1, featured: false,
    description: 'The basics for your first semester: a backpack, notebooks, pens, a calculator and a pen drive for lab files.',
    items: [['Wildcraft Evo 35 L Backpack', 1], ['Classmate Notebook Pack (6 Pack)', 1], ['Gel Pen Set (10 Pack)', 1], ['Casio FX-991ES Plus Calculator', 1], ['SanDisk Ultra USB 3.0 Drive (64 GB)', 1]],
  },
  {
    name: 'ML Beginner Kit', art: 'cloud', audience: 'Students starting machine learning', semester: 5, featured: false,
    description: 'A practical ML book, cloud credits for training jobs and fast storage for your datasets.',
    items: [['Hands-On Machine Learning', 1], ['Cloud Credits for Students (₹2,000)', 1], ['Samsung T7 Portable SSD (1 TB)', 1]],
  },
];

export const coupons = [
  { code: 'STUDENT10', description: '10% off for students, up to ₹500', type: 'percent', value: 10, maxDiscount: 500 },
  { code: 'WELCOME100', description: '₹100 off orders of ₹999 or more', type: 'flat', value: 100, minOrder: 999, perUserLimit: 1 },
  { code: 'FRESHER15', description: '15% off orders of ₹1,500 or more, up to ₹750', type: 'percent', value: 15, minOrder: 1500, maxDiscount: 750, perUserLimit: 1 },
  { code: 'CSE25', description: '25% off big orders of ₹5,000 or more, up to ₹1,500', type: 'percent', value: 25, minOrder: 5000, maxDiscount: 1500, perUserLimit: 1 },
  { code: 'EXPIRED20', description: 'An expired coupon, to show the error message', type: 'percent', value: 20, expired: true },
];
