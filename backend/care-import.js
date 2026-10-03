import fs from 'node:fs';

const unavailable = value => !value || value === 'NA';
export function doctorNames(providerListing) {
  if (unavailable(providerListing) || /roster NA|individual name NA|Individual roster NA|department active|position identified/i.test(providerListing)) return [];
  return providerListing.split(';').map(value => value.trim()).filter(value => /^(?:Dr\.\s+|[A-Z][\p{L}.'-]+(?:\s+[A-Z][\p{L}.'-]+){1,5}(?:,\s*MD)?$)/u.test(value));
}

export function importCareDirectory(db, fileUrl = new URL('./care-directory.json', import.meta.url), transaction = true) {
  const data = JSON.parse(fs.readFileSync(fileUrl, 'utf8').replace(/^\uFEFF/, ''));
  const clinic = db.prepare(`INSERT INTO clinics
    (name,services,address,city,region,postal_code,public_phone,public_email,public_website,source_url,verified_at,is_verified,is_demo,
     facility_type,ownership,provider_listing,schedule,accepts_new_patients,latitude,longitude,coordinate_source)
    VALUES (@facilityName,@services,@address,@city,@province,'',@phone,@email,@website,@source,@verifiedAt,1,0,
     @facilityType,@ownership,@providerListing,@schedule,@acceptsNewPatients,@latitude,@longitude,@coordinateSource)
    ON CONFLICT(name,address) DO UPDATE SET services=excluded.services,city=excluded.city,region=excluded.region,
     public_phone=excluded.public_phone,public_email=excluded.public_email,public_website=excluded.public_website,
     source_url=excluded.source_url,verified_at=excluded.verified_at,is_verified=1,facility_type=excluded.facility_type,
     ownership=excluded.ownership,provider_listing=excluded.provider_listing,schedule=excluded.schedule,
     accepts_new_patients=excluded.accepts_new_patients,latitude=excluded.latitude,longitude=excluded.longitude,
     coordinate_source=excluded.coordinate_source`);
  const doctor = db.prepare(`INSERT INTO doctors
    (display_name,specialty,services,public_phone,public_email,public_website,source_url,verified_at,is_verified,is_demo)
    VALUES (@displayName,'Obstetrics and gynecology',@services,NULL,NULL,NULL,@source,@verifiedAt,1,0)
    ON CONFLICT(display_name,specialty) DO UPDATE SET services=excluded.services,source_url=excluded.source_url,verified_at=excluded.verified_at,is_verified=1`);
  const clinicId = db.prepare('SELECT id FROM clinics WHERE name=? AND address=?');
  const doctorId = db.prepare("SELECT id FROM doctors WHERE display_name=? AND specialty='Obstetrics and gynecology'");
  const link = db.prepare('INSERT OR IGNORE INTO doctor_clinics(doctor_id,clinic_id) VALUES(?,?)');
  const verifiedAt = data.importedAt.slice(0, 10);
  if (transaction) db.exec('BEGIN');
  try {
    for (const raw of data.records) {
      const row = Object.fromEntries(Object.entries(raw).map(([key,value]) => [key, unavailable(value) ? null : value]));
      row.services = raw.services;
      row.providerListing = raw.providerListing;
      row.verifiedAt = verifiedAt;
      clinic.run({ facilityName: row.facilityName, services: row.services, address: row.address, city: row.city,
        province: row.province, phone: row.phone, email: row.email, website: row.website, source: row.source,
        verifiedAt, facilityType: row.facilityType, ownership: row.ownership, providerListing: row.providerListing,
        schedule: row.schedule, acceptsNewPatients: row.acceptsNewPatients, latitude: row.latitude,
        longitude: row.longitude, coordinateSource: row.coordinateSource });
      const facility = clinicId.get(raw.facilityName, raw.address);
      for (const displayName of doctorNames(raw.providerListing)) {
        doctor.run({ displayName, services: raw.services, source: raw.source, verifiedAt });
        link.run(doctorId.get(displayName).id, facility.id);
      }
    }
    if (transaction) db.exec('COMMIT');
  } catch (error) { if (transaction) db.exec('ROLLBACK'); throw error; }
  return { facilities: data.records.length, doctors: new Set(data.records.flatMap(row => doctorNames(row.providerListing))).size, sourceFile: data.sourceFile };
}