# NexoWatt EOS Admin v7.9.61 Modal Autocomplete Layer Fix

## Fix

- Keeps MUI Autocomplete, Select, Menu and Popover portal layers above EOS dialogs.
- Fixes adapter install/update dialog where the adapter search result list appeared behind the modal and could not be selected.
- Keeps native ioBroker Admin behavior intact; no custom adapter-install logic and no DP write logic changes.
- Adds v61 cache-busted host/bootstrap/remote entry files and redirects old v54-v60 entry shims to v61.

## Important

After installation clear the browser cache or use Ctrl+F5 because older v60 index/assets can still be cached by the browser.
