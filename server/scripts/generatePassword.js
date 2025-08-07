const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { encryptPassword, generateSecurePassword } = require('../src/utils/jwtHelper');
const supabase = require('../src/db/supabase');

// Generate a secure admin password and update database
async function generateAdminPassword() {
    try {
        console.log('========================================');
        console.log('GIC Blog Server - Admin Password Generator');
        console.log('========================================');
        
        // Get admin email from environment
        const adminEmail = process.env.ADMIN_EMAIL;
        
        if (!adminEmail) {
            console.error('Error: ADMIN_EMAIL not found in environment variables');
            console.log('Please add ADMIN_EMAIL to your .env file');
            return;
        }
        
        // Check if using custom password or generate new one
        let newPassword = process.env.ADMIN_PASSWORD;
        let isCustomPassword = false;
        
        if (newPassword) {
            console.log('Using custom password from ADMIN_PASSWORD environment variable');
            isCustomPassword = true;
        } else {
            // Generate a secure random password
            const passwordResult = generateSecurePassword(16);
            
            if (!passwordResult.success) {
                console.error('Error generating password:', passwordResult.error);
                return;
            }
            
            newPassword = passwordResult.password;
            console.log('Generated new secure password');
        }
        
        // Encrypt the password
        const encryptionResult = encryptPassword(newPassword);
        
        if (!encryptionResult.success) {
            console.error('Error encrypting password:', encryptionResult.error);
            return;
        }
        
        const encryptedPassword = encryptionResult.encryptedPassword;
        
        console.log(`\nAdmin Email: ${adminEmail}`);
        if (!isCustomPassword) {
            console.log(`Generated Password: ${newPassword}`);
        }
        console.log('Password encrypted successfully');
        
        // Check if admin user already exists
        const { data: existingAdmin, error: fetchError } = await supabase
            .from('admin_users')
            .select('id, email, is_active')
            .eq('email', adminEmail.toLowerCase().trim())
            .single();
        
        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Database error checking existing admin:', fetchError);
            return;
        }
        
        let result;
        
        if (existingAdmin) {
            // Update existing admin user
            console.log('\nExisting admin user found, updating password...');
            
            const { data, error } = await supabase
                .from('admin_users')
                .update({
                    encrypted_password: encryptedPassword,
                    is_active: true,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingAdmin.id)
                .select()
                .single();
            
            if (error) {
                console.error('Error updating admin user:', error);
                return;
            }
            
            result = data;
            console.log('Admin password updated successfully');
            
        } else {
            // Create new admin user
            console.log('\nNo existing admin found, creating new admin user...');
            
            const { data, error } = await supabase
                .from('admin_users')
                .insert([{
                    email: adminEmail.toLowerCase().trim(),
                    encrypted_password: encryptedPassword,
                    is_active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }])
                .select()
                .single();
            
            if (error) {
                console.error('Error creating admin user:', error);
                return;
            }
            
            result = data;
            console.log('New admin user created successfully');
        }
        
        console.log('\n========================================');
        console.log('ADMIN CREDENTIALS');
        console.log('========================================');
        console.log(`Email: ${result.email}`);
        if (!isCustomPassword) {
            console.log(`Password: ${newPassword}`);
            console.log('\nIMPORTANT: Save this password securely!');
            console.log('This is the only time it will be displayed.');
        } else {
            console.log('Password: [Using custom password from environment]');
        }
        console.log(`User ID: ${result.id}`);
        console.log(`Active: ${result.is_active}`);
        console.log(`Created: ${result.created_at}`);
        console.log(`Updated: ${result.updated_at}`);
        console.log('========================================');
        
        if (!isCustomPassword) {
            console.log('\nNext Steps:');
            console.log('1. Save the password in a secure location');
            console.log('2. Optionally, add ADMIN_PASSWORD to your .env file');
            console.log('3. Test login using POST /api/auth/login');
            console.log('4. Delete this password from console/logs for security');
        }
        
    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

// Reset admin password (disable account)
async function disableAdminAccount() {
    try {
        console.log('========================================');
        console.log('GIC Blog Server - Disable Admin Account');
        console.log('========================================');
        
        const adminEmail = process.env.ADMIN_EMAIL;
        
        if (!adminEmail) {
            console.error('Error: ADMIN_EMAIL not found in environment variables');
            return;
        }
        
        // Update admin user to inactive
        const { data, error } = await supabase
            .from('admin_users')
            .update({
                is_active: false,
                updated_at: new Date().toISOString()
            })
            .eq('email', adminEmail.toLowerCase().trim())
            .select()
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                console.log('No admin user found with that email');
                return;
            }
            console.error('Error disabling admin account:', error);
            return;
        }
        
        console.log('Admin account disabled successfully');
        console.log(`Email: ${data.email}`);
        console.log(`Active: ${data.is_active}`);
        console.log(`Updated: ${data.updated_at}`);
        
    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

// List all admin users
async function listAdminUsers() {
    try {
        console.log('========================================');
        console.log('GIC Blog Server - List Admin Users');
        console.log('========================================');
        
        const { data: admins, error } = await supabase
            .from('admin_users')
            .select('id, email, is_active, created_at, updated_at')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error fetching admin users:', error);
            return;
        }
        
        if (!admins || admins.length === 0) {
            console.log('No admin users found');
            return;
        }
        
        console.log(`Found ${admins.length} admin user(s):\n`);
        
        admins.forEach((admin, index) => {
            console.log(`${index + 1}. Admin User:`);
            console.log(`   ID: ${admin.id}`);
            console.log(`   Email: ${admin.email}`);
            console.log(`   Active: ${admin.is_active}`);
            console.log(`   Created: ${admin.created_at}`);
            console.log(`   Updated: ${admin.updated_at}`);
            console.log('');
        });
        
    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

// Main function to handle command line arguments
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
        case 'generate':
        case 'create':
        case undefined:
            await generateAdminPassword();
            break;
            
        case 'disable':
            await disableAdminAccount();
            break;
            
        case 'list':
            await listAdminUsers();
            break;
            
        case 'help':
        case '--help':
        case '-h':
            console.log('GIC Blog Server - Admin Password Generator');
            console.log('');
            console.log('Usage:');
            console.log('  node scripts/generatePassword.js [command]');
            console.log('');
            console.log('Commands:');
            console.log('  generate (default) - Generate/update admin password');
            console.log('  disable           - Disable admin account');
            console.log('  list              - List all admin users');
            console.log('  help              - Show this help message');
            console.log('');
            console.log('Environment Variables Required:');
            console.log('  ADMIN_EMAIL       - Admin email address');
            console.log('  ADMIN_PASSWORD    - (Optional) Custom password');
            console.log('  JWT_SECRET        - Secret for password encryption');
            console.log('  SUPABASE_URL      - Supabase project URL');
            console.log('  SUPABASE_SERVICE_ROLE_KEY - Supabase service key');
            break;
            
        default:
            console.error(`Unknown command: ${command}`);
            console.log('Use "help" command to see available options');
            break;
    }
    
    process.exit(0);
}

// Run the script if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

// Export functions for programmatic use
module.exports = {
    generateAdminPassword,
    disableAdminAccount,
    listAdminUsers
};