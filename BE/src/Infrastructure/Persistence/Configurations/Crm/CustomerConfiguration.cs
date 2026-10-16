using Domain.Entities.Crm.Customers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.Configurations.Crm;

public sealed class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("Crm_Customers");
        builder.Property(x => x.Code).HasMaxLength(Customer.CodeMaxLength).IsRequired();
        builder.Property(x => x.Phone).HasMaxLength(Customer.PhoneMaxLength).IsRequired();
        builder.Property(x => x.FullName).HasMaxLength(Customer.NameMaxLength).IsRequired();
        builder.Property(x => x.Note).HasMaxLength(Customer.NoteMaxLength);
        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.Phone).IsUnique();
    }
}
