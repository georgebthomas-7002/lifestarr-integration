import { config } from "dotenv";

config({ path: ".env.local" });

import { Client } from "@hubspot/api-client";
import {
  PropertyCreateFieldTypeEnum,
  PropertyCreateTypeEnum,
} from "@hubspot/api-client/lib/codegen/crm/properties";

import {
  CONTACT_PROPERTIES,
  LIFESTARR_PROPERTY_GROUP,
  type ContactPropertyDef,
} from "@/lib/hubspot-properties";

const TYPE_MAP: Record<ContactPropertyDef["type"], PropertyCreateTypeEnum> = {
  string: PropertyCreateTypeEnum.String,
  number: PropertyCreateTypeEnum.Number,
  datetime: PropertyCreateTypeEnum.Datetime,
  date: PropertyCreateTypeEnum.Date,
  enumeration: PropertyCreateTypeEnum.Enumeration,
  bool: PropertyCreateTypeEnum.Bool,
};

const FIELD_TYPE_MAP: Record<ContactPropertyDef["fieldType"], PropertyCreateFieldTypeEnum> = {
  text: PropertyCreateFieldTypeEnum.Text,
  number: PropertyCreateFieldTypeEnum.Number,
  date: PropertyCreateFieldTypeEnum.Date,
  select: PropertyCreateFieldTypeEnum.Select,
  radio: PropertyCreateFieldTypeEnum.Radio,
  booleancheckbox: PropertyCreateFieldTypeEnum.Booleancheckbox,
};

const token = process.env.HUBSPOT_API_TOKEN;
if (!token) {
  console.error("HUBSPOT_API_TOKEN not set in .env.local");
  process.exit(1);
}

const hubspot = new Client({ accessToken: token });

async function ensurePropertyGroup() {
  try {
    await hubspot.crm.properties.groupsApi.getByName("contacts", LIFESTARR_PROPERTY_GROUP);
    console.log(`✓ property group "${LIFESTARR_PROPERTY_GROUP}" exists`);
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code !== 404) {
      console.error("Unexpected error checking property group:", err);
      throw err;
    }
    await hubspot.crm.properties.groupsApi.create("contacts", {
      name: LIFESTARR_PROPERTY_GROUP,
      label: "LifeStarr",
      displayOrder: -1,
    });
    console.log(`+ property group "${LIFESTARR_PROPERTY_GROUP}" created`);
  }
}

async function ensureContactProperty(def: ContactPropertyDef) {
  try {
    await hubspot.crm.properties.coreApi.getByName("contacts", def.name);
    console.log(`✓ contact property "${def.name}" exists`);
    return;
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code !== 404) {
      console.error(`Unexpected error checking property "${def.name}":`, err);
      throw err;
    }
  }

  await hubspot.crm.properties.coreApi.create("contacts", {
    name: def.name,
    label: def.label,
    description: def.description,
    groupName: def.groupName,
    type: TYPE_MAP[def.type],
    fieldType: FIELD_TYPE_MAP[def.fieldType],
    options: (def.options ?? []).map((o, i) => ({
      label: o.label,
      value: o.value,
      displayOrder: i,
      hidden: false,
    })),
  });
  console.log(`+ contact property "${def.name}" created`);
}

async function verifyToken() {
  try {
    const groups = await hubspot.crm.properties.groupsApi.getAll("contacts");
    console.log(`HubSpot connection OK — ${groups.results.length} contact property groups visible`);
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 401 || code === 403) {
      console.error("\n❌ HUBSPOT_API_TOKEN is invalid or missing scopes.");
      console.error(
        "   Required: crm.objects.contacts.read/write, crm.schemas.contacts.read/write,\n" +
          "             crm.objects.deals.read/write, crm.schemas.deals.read/write,\n" +
          "             crm.objects.owners.read",
      );
      process.exit(1);
    }
    throw err;
  }
}

async function main() {
  await verifyToken();
  await ensurePropertyGroup();
  for (const prop of CONTACT_PROPERTIES) {
    await ensureContactProperty(prop);
  }
  console.log(
    `\n✅ HubSpot setup complete — ${CONTACT_PROPERTIES.length} contact properties verified`,
  );
}

main().catch((err) => {
  console.error("\n❌ Setup failed:", err);
  process.exit(1);
});
