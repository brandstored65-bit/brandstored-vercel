import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

async function fixCounterSeq() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Get the current counter document
        const counter = await mongoose.connection.db.collection('counters').findOne({ _id: 'order' });
        console.log('Current counter document:', counter);

        if (!counter) {
            console.log('❌ No counter found, creating new one...');
            await mongoose.connection.db.collection('counters').insertOne({
                _id: 'order',
                seq: 55253
            });
            console.log('✅ Created new counter with seq: 55253');
        } else if (typeof counter.seq !== 'number') {
            console.log(`⚠️  Counter seq is corrupted (type: ${typeof counter.seq}), fixing...`);
            await mongoose.connection.db.collection('counters').updateOne(
                { _id: 'order' },
                { $set: { seq: 55253 } }
            );
            console.log('✅ Fixed counter seq to 55253');
        } else {
            console.log('✅ Counter is healthy:', counter.seq);
        }

        // Verify the fix
        const fixed = await mongoose.connection.db.collection('counters').findOne({ _id: 'order' });
        console.log('Final counter document:', fixed);

        await mongoose.connection.close();
        console.log('✅ Database cleanup complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error fixing counter:', error);
        process.exit(1);
    }
}

fixCounterSeq();
