# Merge/update note 7.10.5

Always replace the previous repository with the complete 7.10.5 repository. Do not merge old `adminWww` bundles or deleted role-security files back into this release. In particular, `nexowatt-role-security.js` and `build/lib/eosRoleSecurity.js` are obsolete and must stay absent.

After a merge, run the package, stability, role-security and publish dry-run checks before publishing.
