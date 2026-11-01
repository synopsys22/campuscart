// Demo accounts. Passwords are public on purpose: the login page offers them as one-click buttons.

export const DEMO_ADMIN = {
  name: 'Campus Admin',
  email: 'admin@campuscart.dev',
  password: 'Admin@123',
  phone: '9000000001',
};

export const DEMO_STUDENT = {
  name: 'Aarav Menon',
  email: 'student@campuscart.dev',
  password: 'Student@123',
  phone: '9000000002',
  college: 'National Institute of Technology, Tiruchirappalli',
  branch: 'CSE',
  semester: 5,
  addresses: [
    { label: 'Hostel', line1: 'Room 214, Agate Hostel', line2: 'NIT Campus', city: 'Tiruchirappalli', state: 'Tamil Nadu', pincode: '620015', isDefault: true },
    { label: 'Home', line1: '12 MG Road', line2: 'Near City Library', city: 'Kochi', state: 'Kerala', pincode: '682016', isDefault: false },
  ],
};

export const OTHER_STUDENTS = [
  ['Diya Sharma', 'diya.sharma', 'BITS Pilani', 'CSE', 3, 'Pilani', 'Rajasthan', '333031'],
  ['Kabir Singh', 'kabir.singh', 'Delhi Technological University', 'IT', 5, 'New Delhi', 'Delhi', '110042'],
  ['Ananya Iyer', 'ananya.iyer', 'Anna University', 'CSE', 7, 'Chennai', 'Tamil Nadu', '600025'],
  ['Rohan Gupta', 'rohan.gupta', 'VIT Vellore', 'CSE', 1, 'Vellore', 'Tamil Nadu', '632014'],
  ['Meera Nair', 'meera.nair', 'College of Engineering Trivandrum', 'CSE', 3, 'Thiruvananthapuram', 'Kerala', '695016'],
  ['Arjun Reddy', 'arjun.reddy', 'IIIT Hyderabad', 'CSE', 7, 'Hyderabad', 'Telangana', '500032'],
  ['Sneha Patil', 'sneha.patil', 'College of Engineering Pune', 'IT', 5, 'Pune', 'Maharashtra', '411005'],
  ['Vikram Joshi', 'vikram.joshi', 'RV College of Engineering', 'CSE', 3, 'Bengaluru', 'Karnataka', '560059'],
].map(([name, handle, college, branch, semester, city, state, pincode]) => ({
  name,
  email: `${handle}@campuscart.dev`,
  college,
  branch,
  semester,
  addresses: [{ label: 'Hostel', line1: 'Block B, Student Hostel', line2: college, city, state, pincode, isDefault: true }],
}));
