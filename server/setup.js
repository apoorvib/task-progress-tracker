const { postgresSettings } = require('./config');
const { provision, validateTarget } = require('./provision');
async function setup() {
    const target = postgresSettings();
    validateTarget(target);
    if (process.argv.includes('--describe')) {
        console.log(JSON.stringify(target));
        return;
    }
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    const admin = JSON.parse(input.replace(/^\uFEFF/, ''));
    const result = await provision(admin, target, { appPassword: process.env.POSTGRES_PASSWORD });
    console.log(`Postgres ready: ${result.database} (${result.user}). Only app credentials saved locally.`);
}
setup().catch(error => { console.error(`Setup failed: ${error.code || error.message}`); process.exitCode = 1; });
