const placeholders = {
    username: 'e.g. morwen',
    email: 'e.g. morwen@mail.com',
    firstName: 'First name',
    lastName: 'Last name',
};

const fields = document.querySelectorAll(
    '#kc-register-form input:not([type="hidden"]):not([type="checkbox"]):not([type="submit"]):not([type="password"]), #kc-register-form textarea',
);

for (const field of fields) {
    if (field.placeholder) continue;

    const label = field.labels?.[0]?.textContent?.trim().replace(/\s*\*\s*$/, '');
    field.placeholder = placeholders[field.name] ?? placeholders[field.id] ?? (label ? `Enter ${label.toLowerCase()}` : 'Enter a value');
}