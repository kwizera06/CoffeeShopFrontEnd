
const fs = require('fs');
const filepath = 'c:\\Users\\hp\\Desktop\\Olitech CoffeeShop\\CoffeeShop_Frontend\\src\\pages\\shop\\Owner.jsx';
const content = fs.readFileSync(filepath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
    const stripped = line.trimStart();
    const count = line.length - stripped.length;
    if (count >= 20 && count <= 30) {
        console.log(`Line ${i+1} [${count}]: ${stripped.substring(0, 50).trim()}`);
    }
});
