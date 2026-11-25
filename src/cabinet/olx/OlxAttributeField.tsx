import { useState } from 'react'
import { Check } from 'lucide-react'
import type { OlxAttribute } from '@/api/olx-live'
import {
  Button,
  Field,
  SearchPicker,
  SearchPickerOption,
  SearchPickerOptions,
  SelectPicker,
  TextArea,
  TextInput,
} from '@/components/app'
import { useT } from '@/i18n'
import { olxLiveMessages } from './olx-live-messages'
import {
  hasAttributeValue,
  isCompatibilityWithoutOptions,
} from './olx-prepare-content'

interface AttributeFieldProps {
  attribute: OlxAttribute
  disabled: boolean
  error?: string | undefined
  value: string[]
  onChange: (value: string[]) => void
}

function MultipleAttributePicker({
  attribute,
  disabled,
  error,
  value,
  onChange,
}: AttributeFieldProps) {
  const t = useT(olxLiveMessages)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const term = query.trim().toLocaleLowerCase()
  const options = attribute.values.filter(({ label }) =>
    label.toLocaleLowerCase().includes(term),
  )
  const selectedLabels = attribute.values
    .filter(({ code }) => value.includes(code))
    .map(({ label }) => label)

  return (
    <SearchPicker
      label={attribute.label}
      showLabel
      required={attribute.required}
      disabled={disabled}
      error={error}
      hint={t('multipleHint')}
      placeholder={t('searchAttribute')}
      resultsLabel={attribute.label}
      heading={attribute.label}
      count={options.length}
      headerHidden
      searchable={attribute.values.length > 7}
      triggerLabel={selectedLabels.join(', ') || t('choose')}
      query={query}
      onQueryChange={setQuery}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setQuery('')
      }}
      floating
      allowEmptyQuery
    >
      {options.length === 0 ? (
        <p className="rz-caption m-0 p-3" role="status">
          {t('noResults')}
        </p>
      ) : (
        <SearchPickerOptions label={attribute.label} multiple>
          {options.map(({ code, label }) => {
            const selected = value.includes(code)
            return (
              <SearchPickerOption
                key={code}
                label={label}
                selected={selected}
                aside={
                  selected ? (
                    <Check aria-hidden className="text-app-strong size-4" />
                  ) : null
                }
                onSelect={() =>
                  onChange(
                    selected
                      ? value.filter((item) => item !== code)
                      : [...value, code],
                  )
                }
              >
                {label}
              </SearchPickerOption>
            )
          })}
        </SearchPickerOptions>
      )}
    </SearchPicker>
  )
}

export function OlxAttributeField({
  attribute,
  disabled,
  error,
  value,
  onChange,
}: AttributeFieldProps) {
  const t = useT(olxLiveMessages)
  if (isCompatibilityWithoutOptions(attribute)) {
    const hasValue = hasAttributeValue(value)
    return (
      <div className="grid min-w-0 gap-2">
        <Field
          label={attribute.label}
          required={attribute.required}
          hint={t('compatibilityListHint')}
          error={hasValue ? t('compatibility_list_requires_catalog') : error}
        >
          <TextInput readOnly value={value.join(', ')} />
        </Field>
        {hasValue && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-self-start"
            disabled={disabled}
            onClick={() => onChange([])}
          >
            {t('clearCompatibilityList')}
          </Button>
        )}
      </div>
    )
  }
  if (attribute.values.length > 0 && attribute.multiple)
    return (
      <MultipleAttributePicker
        attribute={attribute}
        disabled={disabled}
        error={error}
        value={value}
        onChange={onChange}
      />
    )
  if (attribute.values.length > 0 && !attribute.multiple)
    return (
      <SelectPicker
        label={attribute.label}
        showLabel
        required={attribute.required}
        disabled={disabled}
        error={error}
        searchable={attribute.values.length > 7}
        placeholder={t('choose')}
        value={value[0] ?? ''}
        onValueChange={(code) => onChange(code ? [code] : [])}
        options={[
          ...(attribute.required ? [] : [{ value: '', label: '—' }]),
          ...attribute.values.map(({ code, label }) => ({
            value: code,
            label,
          })),
        ]}
      />
    )
  return (
    <Field
      label={attribute.label}
      required={attribute.required}
      error={error}
      hint={attribute.multiple ? t('multipleTextHint') : undefined}
    >
      {attribute.multiple ? (
        <TextArea
          rows={3}
          maxLength={10000}
          value={value.join('\n')}
          onChange={(event) => onChange(event.target.value.split('\n'))}
        />
      ) : (
        <TextInput
          inputMode={attribute.numeric ? 'decimal' : 'text'}
          maxLength={1000}
          value={value[0] ?? ''}
          onChange={(event) =>
            onChange(event.target.value ? [event.target.value] : [])
          }
        />
      )}
    </Field>
  )
}
