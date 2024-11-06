import crypto from 'crypto';
import * as fs from 'fs';
import path from 'path';

export class URLSHORTNER {

    static LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
    static URL_FILE = path.join(this.LOG_DIR, 'short_urls.txt');    

    static generateShortCode(length=8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charsLength = chars.length;
        let shortCode = '';

        const randomBytes = crypto.randomBytes(length);

        for (let i = 0; i < length; i++) {
            shortCode += chars[randomBytes[i] % charsLength];
        }

        return shortCode;
    }

    static loadUrls() {
        if (!fs.existsSync(this.URL_FILE)) {
            return {};
        }
        const data = fs.readFileSync(this.URL_FILE, 'utf8');
        return data
            .split('\n')
            .filter(Boolean)
            .reduce((acc, line) => {
                const [shortCode, url] = line.split(',');
                acc[shortCode] = url;
                return acc;
            }, {});
    }

    static saveUrl(shortCode, url) {
        fs.appendFileSync(this.URL_FILE, `${shortCode},${url}\n`);
    }
}